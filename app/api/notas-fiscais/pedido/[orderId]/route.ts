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
    .select('id, name, quantity, unit_price, product_id, ncm, product:products(id, name, unit, ncm), variant:product_variants(sku)')
    .eq('order_id', order.id)

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  // Dados da empresa não entram no payload da NF-e (ver lib/notasFiscais/fieldMapping.ts) —
  // seguem aqui só para exibição na tela de revisão.
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
    unit: item.product?.unit ?? null,
    code: item.variant?.sku || item.product?.id || item.id,
    // NCM do produto do catálogo quando existe; senão o NCM gravado direto
    // no item do pedido (order_items.ncm) — fallback para itens avulsos
    // sem product_id, que não têm onde guardar NCM no cadastro de produto.
    product_ncm: item.product?.ncm ?? item.ncm ?? null,
    // id do produto no catálogo (para a tela de revisão deixar preencher
    // o NCM direto ali, sem precisar ir em Produtos) — não entra no
    // payload da NF-e, só serve de referência pro front. null quando o
    // item não está vinculado a um produto do catálogo (nesse caso o
    // front salva o NCM em order_items.ncm, usando o próprio `id` acima).
    product_id: item.product?.id ?? null,
  }))

  const missingFields = getMissingFields(order.customer, mappedItems)

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
