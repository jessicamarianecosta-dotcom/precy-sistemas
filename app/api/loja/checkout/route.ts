import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { cleanObservation } from '@/lib/catalog/observation'
import { quoteCartShipping } from '@/lib/catalog/shipping/quoteCart'
import { calcOptionsAdjustment } from '@/lib/produtos/variantPricing'

interface CheckoutItem { productId: string; variantId?: string | null; quantity: number; notes?: string | null }
interface PaymentChoice {
  method: 'pix' | 'credit_card'
  installments?: number
  cardToken?: string
  paymentMethodId?: string
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
  const artwork = body?.artwork ?? null
  const payment: PaymentChoice | null = fulfillment === 'online'
    ? { method: body?.payment?.method === 'credit_card' ? 'credit_card' : 'pix', installments: Number(body?.payment?.installments) || 1, cardToken: body?.payment?.cardToken, paymentMethodId: body?.payment?.paymentMethodId }
    : null

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

  /* ── Revalidar a forma de pagamento escolhida contra a configuração
     REAL da loja — nunca confiar que o client só ofereceu modalidades
     habilitadas; alguém podendo forjar o POST poderia tentar cobrar via
     cartão numa loja que só habilitou Pix. ── */
  let paymentSettings: { pix_enabled: boolean; card_enabled: boolean; card_max_installments: number; surcharge_mode: string } | null = null
  if (fulfillment === 'online' && payment) {
    const { data } = await (supabaseAdmin.from('store_payment_settings') as any)
      .select('pix_enabled, card_enabled, card_max_installments, surcharge_mode')
      .eq('company_id', companyId)
      .maybeSingle()
    paymentSettings = data
    const gateway = getPaymentGateway()
    const account = await gateway.getAccountStatus(companyId)
    if (!account.connected || !paymentSettings) {
      return NextResponse.json({ error: 'Pagamento online indisponível para esta loja no momento. Finalize pelo WhatsApp.' }, { status: 409 })
    }
    if (payment.method === 'pix' && !paymentSettings.pix_enabled) {
      return NextResponse.json({ error: 'Pix não está disponível nesta loja' }, { status: 409 })
    }
    if (payment.method === 'credit_card') {
      if (!paymentSettings.card_enabled) {
        return NextResponse.json({ error: 'Cartão de crédito não está disponível nesta loja' }, { status: 409 })
      }
      const installments = payment.installments ?? 1
      if (installments < 1 || installments > paymentSettings.card_max_installments) {
        return NextResponse.json({ error: `Parcelamento inválido (máximo ${paymentSettings.card_max_installments}x)` }, { status: 400 })
      }
      if (!payment.cardToken || !payment.paymentMethodId) {
        return NextResponse.json({ error: 'Dados do cartão incompletos' }, { status: 400 })
      }
    }
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
  if (fulfillment === 'online') {
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
      art_status: artwork ? 'recebida' : 'nao_enviada',
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
    }])
    .select('id, order_number')
    .single()

  if (orderError) {
    return NextResponse.json({ error: `Erro ao criar pedido: ${orderError.message}` }, { status: 500 })
  }

  const { error: itemsError } = await (supabaseAdmin.from('order_items') as any)
    .insert(orderItems.map(i => ({ ...i, order_id: order.id })))

  if (itemsError) {
    return NextResponse.json({ error: `Erro ao registrar itens do pedido: ${itemsError.message}` }, { status: 500 })
  }

  if (artwork?.url) {
    await (supabaseAdmin.from('order_files') as any).insert([{
      order_id: order.id,
      company_id: companyId,
      file_name: artwork.fileName,
      file_url: artwork.url,
      file_path: artwork.path,
      file_size: artwork.fileSize ?? 0,
      mime_type: artwork.mimeType,
      uploaded_by: 'cliente',
    }])
    await (supabaseAdmin.from('order_art_events') as any).insert([{
      order_id: order.id,
      company_id: companyId,
      event_type: 'arte_enviada',
      description: `Arte enviada pelo cliente: ${artwork.fileName}`,
    }])
  }

  /* ── Finalização pelo WhatsApp: pedido fica pendente, sem cobrança no
     gateway — o cliente combina o pagamento direto com o lojista. Devolve
     só os dados do pedido; quem monta a mensagem e abre o WhatsApp é o
     frontend, que já tem o número configurado da loja. ── */
  if (fulfillment === 'whatsapp') {
    return NextResponse.json({ orderId: order.id, orderNumber: order.order_number, fulfillment: 'whatsapp' })
  }

  /* ── Criar a cobrança no gateway (Pix ou cartão) e persistir o detalhe
     técnico em `payments`, além do snapshot em `orders` — total/taxa nunca
     são recalculados depois, mesmo que a configuração de taxas mude. ── */
  const gateway = getPaymentGateway()
  const description = `Pedido ${order.order_number} — Catálogo Online`

  try {
    if (payment!.method === 'pix') {
      const charge = await gateway.createPixPayment({
        companyId, checkoutRef, netAmount: total, description,
        customerName: customer.name, customerEmail: customer.email || null, customerDocument: customer.cpfCnpj ?? null,
      })

      await (supabaseAdmin.from('payments') as any).insert([{
        company_id: companyId, order_id: order.id, provider: 'mercadopago', provider_payment_id: charge.providerPaymentId,
        checkout_ref: checkoutRef, payment_method: 'pix', installments: 1, status: charge.status,
        amount: charge.grossAmount, net_amount: charge.netAmount, fee_amount: charge.feeAmount,
        fee_percent_snapshot: charge.feePercentSnapshot, fee_fixed_snapshot: charge.feeFixedSnapshot,
        pix_qr_code: charge.qrCode, pix_qr_code_base64: charge.qrCodeBase64, pix_expires_at: charge.expiresAt,
        raw_response: charge.raw,
      }])
      await (supabaseAdmin.from('orders') as any).update({
        payment_provider: 'mercadopago', payment_method: 'pix', installments: 1,
        net_amount: charge.netAmount, fee_amount: charge.feeAmount,
        fee_percent_snapshot: charge.feePercentSnapshot, fee_fixed_snapshot: charge.feeFixedSnapshot,
      }).eq('id', order.id)

      return NextResponse.json({
        orderId: order.id, orderNumber: order.order_number, checkoutRef,
        paymentMethod: 'pix', status: charge.status, amount: charge.grossAmount,
        qrCode: charge.qrCode, qrCodeBase64: charge.qrCodeBase64, expiresAt: charge.expiresAt,
      })
    }

    const installments = payment!.installments ?? 1
    const charge = await gateway.createCardPayment({
      companyId, checkoutRef, netAmount: total, installments,
      cardToken: payment!.cardToken!, paymentMethodId: payment!.paymentMethodId!, description,
      customerName: customer.name, customerEmail: customer.email || null,
      customerDocument: customer.cpfCnpj ?? null, customerDocumentType: customer.cpfCnpj && customer.cpfCnpj.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF',
    })

    await (supabaseAdmin.from('payments') as any).insert([{
      company_id: companyId, order_id: order.id, provider: 'mercadopago', provider_payment_id: charge.providerPaymentId,
      checkout_ref: checkoutRef, payment_method: 'credit_card', installments, status: charge.status,
      amount: charge.grossAmount, net_amount: charge.netAmount, fee_amount: charge.feeAmount,
      fee_percent_snapshot: charge.feePercentSnapshot, fee_fixed_snapshot: charge.feeFixedSnapshot,
      failure_reason: charge.statusDetail ?? null, raw_response: charge.raw,
    }])
    await (supabaseAdmin.from('orders') as any).update({
      total: charge.grossAmount, payment_provider: 'mercadopago', payment_method: 'credit_card', installments,
      net_amount: charge.netAmount, fee_amount: charge.feeAmount,
      fee_percent_snapshot: charge.feePercentSnapshot, fee_fixed_snapshot: charge.feeFixedSnapshot,
      payment_status: charge.status === 'rejected' ? 'failed' : undefined,
    }).eq('id', order.id)

    if (charge.status === 'approved') {
      const { applyCatalogPaymentConfirmed } = await import('@/lib/orders/catalogPaymentCascade')
      await applyCatalogPaymentConfirmed({ ref: checkoutRef, status: 'paid', amount: charge.grossAmount, paymentMethod: 'credit_card', raw: charge.raw }, 'mercadopago')
    }

    return NextResponse.json({
      orderId: order.id, orderNumber: order.order_number, checkoutRef,
      paymentMethod: 'credit_card', status: charge.status, amount: charge.grossAmount, installments,
      statusDetail: charge.statusDetail,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao iniciar pagamento' }, { status: 502 })
  }
}
