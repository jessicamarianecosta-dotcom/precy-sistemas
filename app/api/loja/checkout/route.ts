import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { cleanObservation } from '@/lib/catalog/observation'
import { quoteCartShipping } from '@/lib/catalog/shipping/quoteCart'
import { calcOptionsAdjustment } from '@/lib/produtos/variantPricing'

interface CheckoutItem { productId: string; variantId?: string | null; quantity: number; notes?: string | null }

interface UploadedArtFileBody { url: string; path: string; fileName: string; fileSize: number; mimeType: string | null }

interface ItemArtBody {
  origin: 'own' | 'lumilife' | null
  ownFiles?: UploadedArtFileBody[]
  brief?: { text?: string; colors?: string; style?: string; description?: string }
  referenceFiles?: UploadedArtFileBody[]
}

function itemKeyOf(productId: string, variantId?: string | null) {
  return `${productId}:${variantId ?? ''}`
}

/**
 * POST /api/loja/checkout
 * Rota pública (visitante anônimo da loja) — cria o pedido pendente
 * (orders + order_items, source='catalog') e devolve os dados de pagamento
 * do Mercado Pago (ou do adapter mock). O pagamento em si só cai nos demais
 * módulos (Financeiro/Clientes/Estoque/Agenda) quando o webhook confirma —
 * ver app/api/webhooks/mercadopago/route.ts.
 *
 * IMPORTANTE: preço/estoque/publicação são sempre revalidados aqui a
 * partir do banco — nunca confiar em valores vindos do carrinho do client.
 */
export async function POST(request: Request) {
  // Rota pública sem sessão — limita por IP para reduzir spam de pedidos
  // falsos (não impede uso legítimo, só abuso automatizado).
  if (!checkRateLimit(`loja-checkout:${getClientIp(request)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  const items: CheckoutItem[] = Array.isArray(body?.items) ? body.items : []
  const customer = body?.customer ?? {}
  // 'online' (padrão) cria o pedido e já inicia a cobrança no gateway.
  // 'whatsapp' cria o MESMO pedido pendente (mesma validação de preço/estoque
  // abaixo) mas pula a cobrança — o cliente finaliza combinando o pagamento
  // direto com o lojista pelo WhatsApp. Nunca é tratado como pago só por
  // escolher essa opção.
  const fulfillment: 'online' | 'whatsapp' = body?.fulfillment === 'whatsapp' ? 'whatsapp' : 'online'
  // O preço do frete nunca é lido do client: o servidor recota a mesma
  // modalidade (shippingService) a partir do CEP informado e do peso/
  // dimensões reais dos produtos antes de cobrar qualquer coisa.
  const shippingService: string | null = body?.shippingService ? String(body.shippingService) : null
  const shippingCep: string = String(body?.shippingCep ?? '').replace(/\D/g, '')
  // Entrega por transportadora ou retirada no local (grátis, sem exigir
  // endereço de entrega nem cotação de frete).
  const fulfillmentMethod: 'shipping' | 'pickup' = body?.fulfillmentMethod === 'pickup' ? 'pickup' : 'shipping'
  const pickupChoice: 'self' | 'uber_flash' | null = body?.pickupChoice === 'uber_flash' ? 'uber_flash' : body?.pickupChoice === 'self' ? 'self' : null
  // Arte por item (Etapa 2 do checkout) — nunca um upload único por pedido:
  // cada item do carrinho tem sua própria origem de arte, arquivos e
  // briefing, indexados pela mesma chave do carrinho no client
  // (`${productId}:${variantId ?? ''}`).
  const itemsArt: Record<string, ItemArtBody> = body?.itemsArt && typeof body.itemsArt === 'object' ? body.itemsArt : {}

  if (!slug || items.length === 0) {
    return NextResponse.json({ error: 'Dados insuficientes para finalizar o pedido' }, { status: 400 })
  }
  if (!customer.name || !customer.phone) {
    return NextResponse.json({ error: 'Nome e telefone são obrigatórios' }, { status: 400 })
  }

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
  }

  /* ── Revalidar produtos: publicados, ativos e da mesma empresa ── */
  const productIds = items.map(i => i.productId)
  const { data: products, error: productsError } = await (supabaseAdmin.from('products') as any)
    .select('id, name, catalog_starting_price, catalog_promo_price, final_price')
    .in('id', productIds)
    .eq('company_id', companyId)
    .eq('is_published_catalog', true)

  if (productsError || !products || products.length === 0) {
    return NextResponse.json({ error: 'Produtos indisponíveis' }, { status: 400 })
  }

  // Preço efetivo: promocional (quando definido e menor que o preço normal) tem prioridade —
  // precisa espelhar exatamente a mesma regra usada na exibição pública do produto.
  const priceById = new Map(products.map((p: any) => {
    const basePrice = Number(p.catalog_starting_price ?? p.final_price ?? 0)
    const promoPrice = p.catalog_promo_price != null ? Number(p.catalog_promo_price) : null
    const effectivePrice = promoPrice != null && promoPrice < basePrice ? promoPrice : basePrice
    return [p.id, effectivePrice]
  }))
  const nameById = new Map(products.map((p: any) => [p.id, p.name as string]))

  /* ── Revalidar variantes (estoque de variação é conceito separado do estoque
     de matéria-prima/BOM — nunca confiar em preço/label vindos do client) ── */
  const variantIds = [...new Set(items.map(i => i.variantId).filter(Boolean))] as string[]
  const variantsById = new Map<string, any>()
  if (variantIds.length > 0) {
    const { data: variants } = await (supabaseAdmin.from('product_variants') as any)
      .select(`
        id, product_id, sku, price, stock_quantity, image_id, is_active,
        product_variant_option_values(
          option_id,
          product_variation_options(value, price_adjustment_type, price_adjustment_value, product_variation_groups(name))
        )
      `)
      .in('id', variantIds)
      .in('product_id', productIds)
      .eq('company_id', companyId)
      .eq('is_active', true)
    for (const v of variants ?? []) variantsById.set(v.id, v)
  }

  const imageIds = [...variantsById.values()].map(v => v.image_id).filter(Boolean)
  const imageUrlById = new Map<string, string>()
  if (imageIds.length > 0) {
    const { data: imgs } = await (supabaseAdmin.from('product_images') as any).select('id, url').in('id', imageIds)
    for (const img of imgs ?? []) imageUrlById.set(img.id, img.url)
  }

  function buildVariantLabel(variant: any): string {
    return (variant.product_variant_option_values ?? [])
      .map((ov: any) => `${ov.product_variation_options?.product_variation_groups?.name}: ${ov.product_variation_options?.value}`)
      .join(' · ')
  }

  const validItems = items.filter(i => priceById.has(i.productId) && i.quantity > 0)

  // Primeira passagem: valida existência de variante e estoque suficiente para
  // TODOS os itens antes de criar qualquer coisa — checkout é tudo ou nada.
  for (const i of validItems) {
    if (!i.variantId) continue
    const variant = variantsById.get(i.variantId)
    const productName = nameById.get(i.productId)
    if (!variant || variant.product_id !== i.productId) {
      return NextResponse.json({ error: `Variação indisponível para "${productName}"` }, { status: 400 })
    }
    if (variant.stock_quantity != null && variant.stock_quantity < i.quantity) {
      return NextResponse.json({
        error: `Estoque insuficiente para "${productName}" (${buildVariantLabel(variant)}): disponível ${variant.stock_quantity}, solicitado ${i.quantity}`,
      }, { status: 400 })
    }
  }

  const orderItems = validItems.map(i => {
    const variant = i.variantId ? variantsById.get(i.variantId) : null
    const basePrice = priceById.get(i.productId) as number
    const variantBasePrice = variant?.price != null ? Number(variant.price) : basePrice
    // Acréscimo das opções da combinação (ex: "Personalizar +10%") — nunca
    // confia em preço vindo do client, sempre recalcula a partir das opções
    // revalidadas acima (mesma regra da exibição pública do produto).
    const optionAdjustments = (variant?.product_variant_option_values ?? []).map((ov: any) => ov.product_variation_options)
    const unitPrice = calcOptionsAdjustment(variantBasePrice, optionAdjustments).finalPrice
    const art = itemsArt[itemKeyOf(i.productId, i.variantId)]
    const artOrigin = art?.origin === 'own' || art?.origin === 'lumilife' ? art.origin : null
    return {
      product_id: i.productId,
      name: nameById.get(i.productId),
      quantity: i.quantity,
      unit_price: unitPrice,
      subtotal: unitPrice * i.quantity,
      variant_id: variant?.id ?? null,
      variant_label: variant ? buildVariantLabel(variant) : null,
      variant_sku: variant?.sku ?? null,
      variant_photo: variant?.image_id ? imageUrlById.get(variant.image_id) ?? null : null,
      technical_notes: cleanObservation(i.notes),
      art_origin: artOrigin,
      art_brief: artOrigin === 'lumilife'
        ? {
            text: String(art?.brief?.text ?? '').slice(0, 300),
            colors: String(art?.brief?.colors ?? '').slice(0, 300),
            style: String(art?.brief?.style ?? '').slice(0, 300),
            description: String(art?.brief?.description ?? '').slice(0, 2000),
          }
        : null,
    }
  })

  if (orderItems.length === 0) {
    return NextResponse.json({ error: 'Nenhum item válido no carrinho' }, { status: 400 })
  }

  /* ── Revalidar frete: recota a mesma modalidade escolhida a partir do
     CEP e do peso/dimensões reais dos produtos — o preço nunca vem do
     client. Pedido via WhatsApp pode seguir sem frete calculado (o
     lojista combina a entrega direto com o cliente). ── */
  let shippingPrice = 0
  let shippingDays: number | null = null
  if (fulfillment === 'online' && fulfillmentMethod === 'shipping') {
    if (!shippingService || shippingCep.length !== 8) {
      return NextResponse.json({ error: 'Calcule e escolha uma opção de frete antes de finalizar' }, { status: 400 })
    }
    let quotes
    try {
      quotes = await quoteCartShipping(companyId, shippingCep, validItems.map(i => ({ productId: i.productId, quantity: i.quantity })))
    } catch (err: any) {
      return NextResponse.json({ error: err?.message ?? 'Erro ao validar o frete' }, { status: 502 })
    }
    const matched = (quotes ?? []).find(q => q.service === shippingService)
    if (!matched) {
      return NextResponse.json({ error: 'A opção de frete escolhida não está mais disponível. Calcule o frete novamente.' }, { status: 409 })
    }
    shippingPrice = matched.price
    shippingDays = matched.days
  }

  const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0)
  const total = subtotal + shippingPrice

  // Endereço estruturado em uma linha — mantém compatibilidade com o campo
  // de texto livre `customers.address` usado no resto do sistema.
  const addressLine = [
    [customer.street, customer.number].filter(Boolean).join(', '),
    customer.complement,
  ].filter(Boolean).join(' - ') || null

  /* ── Dedup de cliente por telefone dentro da empresa ── */
  const phone = String(customer.phone).replace(/\D/g, '')
  let customerId: string
  const { data: existingCustomer } = await (supabaseAdmin.from('customers') as any)
    .select('id')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .maybeSingle()

  if (existingCustomer) {
    customerId = existingCustomer.id
    await (supabaseAdmin.from('customers') as any)
      .update({
        name: customer.name,
        email: customer.email || undefined,
        address: addressLine,
        city: customer.city || null,
        state: customer.state || null,
        cpf_cnpj: customer.cpfCnpj ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
  } else {
    const { data: newCustomer, error: customerError } = await (supabaseAdmin.from('customers') as any)
      .insert([{
        company_id: companyId,
        name: customer.name,
        phone,
        email: customer.email || null,
        address: addressLine,
        city: customer.city || null,
        state: customer.state || null,
        cpf_cnpj: customer.cpfCnpj ?? null,
      }])
      .select('id')
      .single()
    if (customerError) {
      return NextResponse.json({ error: `Erro ao registrar cliente: ${customerError.message}` }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  /* ── Criar pedido pendente ── */
  const checkoutRef = randomUUID()
  // notes fica só com texto livre do cliente — endereço e arte enviada
  // viram colunas estruturadas (delivery_* / order_files), nunca mais
  // texto solto aqui.
  const notesParts = [customer.notes ? `Observações: ${customer.notes}` : null].filter(Boolean)

  const { data: order, error: orderError } = await (supabaseAdmin.from('orders') as any)
    .insert([{
      company_id: companyId,
      customer_id: customerId,
      order_number: '',
      status: 'pending',
      payment_status: 'pending',
      service_name: orderItems[0].name,
      subtotal,
      delivery_fee: shippingPrice,
      total,
      notes: notesParts.join(' · ') || null,
      source: 'catalog',
      catalog_checkout_ref: checkoutRef,
      art_status: 'nao_enviada',
      description: fulfillment === 'whatsapp' ? 'Pedido via Catálogo Online (WhatsApp)' : 'Pedido via Catálogo Online',
      delivery_email: customer.email || null,
      delivery_cep: customer.cep ? customer.cep.replace(/\D/g, '') : null,
      delivery_street: customer.street || null,
      delivery_number: customer.number || null,
      delivery_complement: customer.complement || null,
      delivery_neighborhood: customer.neighborhood || null,
      delivery_city: customer.city || null,
      delivery_state: customer.state || null,
      shipping_service: shippingService,
      shipping_days: shippingDays,
      fulfillment_method: fulfillmentMethod,
      pickup_choice: fulfillmentMethod === 'pickup' ? pickupChoice : null,
    }])
    .select('id, order_number')
    .single()

  if (orderError) {
    return NextResponse.json({ error: `Erro ao criar pedido: ${orderError.message}` }, { status: 500 })
  }

  const { data: insertedItems, error: itemsError } = await (supabaseAdmin.from('order_items') as any)
    .insert(orderItems.map(i => ({ ...i, order_id: order.id })))
    .select('id, product_id, variant_id')

  if (itemsError) {
    return NextResponse.json({ error: `Erro ao registrar itens do pedido: ${itemsError.message}` }, { status: 500 })
  }

  // Arquivos de arte/referência de cada item — sempre vinculados ao
  // order_item_id certo, isolando-os entre produtos diferentes do mesmo
  // pedido (nunca um upload único genérico do pedido inteiro).
  const fileRows: any[] = []
  const artEvents: any[] = []
  let anyArtProvided = false

  for (const row of insertedItems ?? []) {
    const art = itemsArt[itemKeyOf(row.product_id, row.variant_id)]
    if (!art?.origin) continue

    if (art.origin === 'own' && Array.isArray(art.ownFiles)) {
      for (const f of art.ownFiles) {
        if (!f?.url) continue
        anyArtProvided = true
        fileRows.push({
          order_id: order.id, order_item_id: row.id, company_id: companyId,
          file_name: f.fileName, file_url: f.url, file_path: f.path,
          file_size: f.fileSize ?? 0, mime_type: f.mimeType,
          uploaded_by: 'cliente', file_role: 'cliente_arte',
        })
      }
      if (art.ownFiles.length > 0) {
        artEvents.push({
          order_id: order.id, company_id: companyId, event_type: 'arte_enviada',
          description: `Arte própria enviada pelo cliente (${art.ownFiles.length} arquivo(s))`,
        })
      }
    }

    if (art.origin === 'lumilife') {
      anyArtProvided = true
      if (Array.isArray(art.referenceFiles)) {
        for (const f of art.referenceFiles) {
          if (!f?.url) continue
          fileRows.push({
            order_id: order.id, order_item_id: row.id, company_id: companyId,
            file_name: f.fileName, file_url: f.url, file_path: f.path,
            file_size: f.fileSize ?? 0, mime_type: f.mimeType,
            uploaded_by: 'cliente', file_role: 'referencia',
          })
        }
      }
      artEvents.push({
        order_id: order.id, company_id: companyId, event_type: 'briefing_recebido',
        description: 'Cliente solicitou criação de arte pela equipe e enviou o briefing.',
      })
    }
  }

  if (fileRows.length > 0) await (supabaseAdmin.from('order_files') as any).insert(fileRows)
  if (artEvents.length > 0) await (supabaseAdmin.from('order_art_events') as any).insert(artEvents)

  if (anyArtProvided) {
    await (supabaseAdmin.from('orders') as any).update({ art_status: 'recebida' }).eq('id', order.id)
  }

  /* ── Finalização pelo WhatsApp: pedido fica pendente, sem cobrança no
     gateway — o cliente combina o pagamento direto com o lojista. Devolve
     só os dados do pedido; quem monta a mensagem e abre o WhatsApp é o
     frontend, que já tem o número configurado da loja. ── */
  if (fulfillment === 'whatsapp') {
    return NextResponse.json({ orderId: order.id, orderNumber: order.order_number, fulfillment: 'whatsapp' })
  }

  /* ── Pagamento pelo site: o pedido fica criado e pendente; a cobrança em
     si (Pix/cartão, inline via Payment Brick) só acontece na Etapa 4, numa
     chamada separada (/api/loja/pagamento) depois que o cliente escolhe e
     confirma a forma de pagamento. Aqui só devolvemos o total REAL (nunca
     o que o client calculou) para inicializar o Brick com o valor certo. ── */
  return NextResponse.json({ orderId: order.id, orderNumber: order.order_number, checkoutRef, total })
}
