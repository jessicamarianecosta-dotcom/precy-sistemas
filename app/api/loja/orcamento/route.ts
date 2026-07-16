import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * POST /api/loja/orcamento
 * Rota pública — visitante da loja solicita orçamento de um produto
 * (fluxo alternativo ao checkout, quando checkout_mode = 'quote').
 * Cria um orçamento (budgets) em rascunho, reaproveitando o módulo
 * Orçamentos já existente — o lojista continua o atendimento por lá.
 */
export async function POST(request: Request) {
  // Rota pública sem sessão — limita por IP para reduzir spam de
  // orçamentos falsos (não impede uso legítimo, só abuso automatizado).
  if (!checkRateLimit(`loja-orcamento:${getClientIp(request)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  const productId = String(body?.productId ?? '')
  const variantId = body?.variantId ? String(body.variantId) : null
  const customer = body?.customer ?? {}

  if (!slug || !productId || !customer.name || !customer.phone) {
    return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })
  }

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
  }

  const { data: product } = await (supabaseAdmin.from('products') as any)
    .select('id, name, catalog_starting_price, catalog_promo_price, final_price')
    .eq('id', productId).eq('company_id', companyId).eq('is_published_catalog', true)
    .single()
  if (!product) return NextResponse.json({ error: 'Produto indisponível' }, { status: 400 })

  // Nunca confiar no preço/label vindos do client — revalida a variante no servidor
  // exatamente como o checkout faz.
  let variant: any = null
  let variantLabel: string | null = null
  if (variantId) {
    const { data } = await (supabaseAdmin.from('product_variants') as any)
      .select(`
        id, sku, price, is_active,
        product_variant_option_values(
          option_id,
          product_variation_options(value, product_variation_groups(name))
        )
      `)
      .eq('id', variantId).eq('product_id', productId).eq('company_id', companyId).eq('is_active', true)
      .maybeSingle()
    if (!data) return NextResponse.json({ error: 'Variação indisponível' }, { status: 400 })
    variant = data
    variantLabel = (data.product_variant_option_values ?? [])
      .map((ov: any) => `${ov.product_variation_options?.product_variation_groups?.name}: ${ov.product_variation_options?.value}`)
      .join(' · ')
  }

  const phone = String(customer.phone).replace(/\D/g, '')
  let customerId: string
  const { data: existing } = await (supabaseAdmin.from('customers') as any)
    .select('id').eq('company_id', companyId).eq('phone', phone).maybeSingle()

  if (existing) {
    customerId = existing.id
  } else {
    const { data: created, error } = await (supabaseAdmin.from('customers') as any)
      .insert([{ company_id: companyId, name: customer.name, phone }])
      .select('id').single()
    if (error) return NextResponse.json({ error: `Erro ao registrar cliente: ${error.message}` }, { status: 500 })
    customerId = created.id
  }

  const basePrice = Number(product.catalog_starting_price ?? product.final_price ?? 0)
  const promoPrice = product.catalog_promo_price != null ? Number(product.catalog_promo_price) : null
  const productEffectivePrice = promoPrice != null && promoPrice < basePrice ? promoPrice : basePrice
  const price = variant?.price != null ? Number(variant.price) : productEffectivePrice

  const { data: budget, error: budgetError } = await (supabaseAdmin.from('budgets') as any)
    .insert([{
      company_id: companyId,
      customer_id: customerId,
      budget_number: '',
      status: 'draft',
      subtotal: price,
      total: price,
      notes: `Solicitado pelo Catálogo Online${customer.message ? ` — ${customer.message}` : ''}`,
    }])
    .select('id, budget_number')
    .single()
  if (budgetError) return NextResponse.json({ error: `Erro ao criar orçamento: ${budgetError.message}` }, { status: 500 })

  const { error: itemError } = await (supabaseAdmin.from('budget_items') as any)
    .insert([{
      budget_id: budget.id, product_id: product.id, name: product.name,
      quantity: 1, unit_price: price, subtotal: price,
      variant_id: variant?.id ?? null, variant_label: variantLabel,
    }])
  if (itemError) return NextResponse.json({ error: `Erro ao registrar item: ${itemError.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, budgetId: budget.id })
}
