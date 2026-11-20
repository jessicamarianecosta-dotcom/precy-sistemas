import { NextRequest, NextResponse } from 'next/server'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMissingFields } from '@/lib/notasFiscais/fieldMapping'

/**
 * GET /api/notas-fiscais/pedido/[orderId]
 *
 * Dados de revisão pra iniciar (ou acompanhar) a nota fiscal de um
 * pedido: dados do pedido/cliente/itens já aproveitados do cadastro,
 * lista do que falta preencher pra emitir, e a nota já existente para
 * esse pedido (se houver — nunca deixa abrir uma segunda enquanto a
 * primeira ainda está viva, ver índice único em fiscal_invoices).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireNotasFiscaisAccess()
  if (!auth.ok) return auth.response

  const { orderId } = await params

  const { data: order, error: orderErr } = await (supabaseAdmin.from('orders') as any)
    .select('id, order_number, total, customer_id, customer:customers(*)')
    .eq('id', orderId)
    .eq('company_id', auth.companyId)
    .maybeSingle()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  const { data: items, error: itemsErr } = await (supabaseAdmin.from('order_items') as any)
    .select('id, name, quantity, unit_price, product_id, product:products(id, name, ncm, cfop)')
    .eq('order_id', order.id)

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  const { data: company, error: companyErr } = await (supabaseAdmin.from('companies') as any)
    .select('name, cnpj, inscricao_estadual, regime_tributario, street, number, neighborhood, city, state, zip_code')
    .eq('id', auth.companyId)
    .maybeSingle()

  if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 500 })

  const mappedItems = (items ?? []).map((item: any) => ({
    id: item.id,
    name: item.name ?? item.product?.name ?? null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    product_ncm: item.product?.ncm ?? null,
    product_cfop: item.product?.cfop ?? null,
  }))

  const missingFields = getMissingFields(company, order.customer, mappedItems)

  const { data: existingInvoice } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .select('*')
    .eq('order_id', order.id)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    order: { id: order.id, order_number: order.order_number, total: order.total },
    customer: order.customer,
    items: mappedItems,
    company,
    missingFields,
    existingInvoice: existingInvoice ?? null,
  })
}
