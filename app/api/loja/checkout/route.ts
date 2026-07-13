import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPaymentAdapter } from '@/lib/catalog/payments'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'

interface CheckoutItem { productId: string; variantId?: string | null; quantity: number }

/**
 * POST /api/loja/checkout
 * Rota pública (visitante anônimo da loja) — cria o pedido pendente
 * (orders + order_items, source='catalog') e devolve os dados de pagamento
 * da InfinityPay (ou do adapter mock). O pagamento em si só cai nos demais
 * módulos (Financeiro/Clientes/Estoque/Agenda) quando o webhook confirma —
 * ver app/api/webhooks/infinitypay/route.ts.
 *
 * IMPORTANTE: preço/estoque/publicação são sempre revalidados aqui a
 * partir do banco — nunca confiar em valores vindos do carrinho do client.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  const items: CheckoutItem[] = Array.isArray(body?.items) ? body.items : []
  const customer = body?.customer ?? {}
  // Nunca confiar cegamente no valor de frete vindo do client — só ele decide
  // o total cobrado no pagamento. Sem re-cotação server-side (ver nota no
  // relatório de auditoria), pelo menos garante que não é negativo/absurdo.
  const rawShipping = Number(body?.shippingPrice ?? 0)
  const shippingPrice = Number.isFinite(rawShipping) ? Math.min(Math.max(rawShipping, 0), 10000) : 0
  const artworkUrl = body?.artworkUrl ?? null

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
          product_variation_options(value, product_variation_groups(name))
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
    const unitPrice = variant?.price != null ? Number(variant.price) : basePrice
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
    }
  })

  if (orderItems.length === 0) {
    return NextResponse.json({ error: 'Nenhum item válido no carrinho' }, { status: 400 })
  }

  const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0)
  const total = subtotal + shippingPrice

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
        address: customer.address ?? null,
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
        address: customer.address ?? null,
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
  const notesParts = [
    customer.notes ? `Observações: ${customer.notes}` : null,
    customer.cep ? `CEP: ${customer.cep}` : null,
    artworkUrl ? `Arte enviada: ${artworkUrl}` : null,
  ].filter(Boolean)

  const { data: order, error: orderError } = await (supabaseAdmin.from('orders') as any)
    .insert([{
      company_id: companyId,
      customer_id: customerId,
      order_number: '',
      status: 'pending',
      payment_status: 'pending',
      service_name: orderItems[0].name,
      description: 'Pedido via Catálogo Online',
      subtotal,
      delivery_fee: shippingPrice,
      total,
      notes: notesParts.join(' · ') || null,
      source: 'catalog',
      catalog_checkout_ref: checkoutRef,
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

  /* ── Criar cobrança no adapter de pagamento (InfinityPay ou mock) ── */
  const adapter = getPaymentAdapter()
  try {
    const charge = await adapter.createCharge({
      ref: checkoutRef,
      amount: total,
      customerName: customer.name,
      customerDocument: customer.cpfCnpj ?? null,
      customerPhone: phone,
      description: `Pedido ${order.order_number} — Catálogo Online`,
    })
    return NextResponse.json({ orderId: order.id, orderNumber: order.order_number, ...charge })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao iniciar pagamento' }, { status: 502 })
  }
}
