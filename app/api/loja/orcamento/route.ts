import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/loja/orcamento
 * Rota pública — visitante da loja solicita orçamento de um produto
 * (fluxo alternativo ao checkout, quando checkout_mode = 'quote').
 * Cria um orçamento (budgets) em rascunho, reaproveitando o módulo
 * Orçamentos já existente — o lojista continua o atendimento por lá.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  const productId = String(body?.productId ?? '')
  const customer = body?.customer ?? {}

  if (!slug || !productId || !customer.name || !customer.phone) {
    return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })
  }

  const { data: settings } = await (supabaseAdmin.from('catalog_settings') as any)
    .select('company_id, companies:company_id(current_plan)')
    .eq('slug', slug)
    .single()
  if (!settings || settings.companies?.current_plan !== 'pro') {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
  }
  const companyId = settings.company_id as string

  const { data: product } = await (supabaseAdmin.from('products') as any)
    .select('id, name, catalog_starting_price, final_price')
    .eq('id', productId).eq('company_id', companyId).eq('is_published_catalog', true)
    .single()
  if (!product) return NextResponse.json({ error: 'Produto indisponível' }, { status: 400 })

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

  const price = Number(product.catalog_starting_price ?? product.final_price ?? 0)

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
    .insert([{ budget_id: budget.id, product_id: product.id, name: product.name, quantity: 1, unit_price: price, subtotal: price }])
  if (itemError) return NextResponse.json({ error: `Erro ao registrar item: ${itemError.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, budgetId: budget.id })
}
