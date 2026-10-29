import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/loja/pedido/[ref]
 * Rota pública de acompanhamento de pedido — [ref] é o
 * `catalog_checkout_ref` (UUID gerado no checkout, nunca exposto em listas
 * públicas), funcionando como token de acesso: só quem tem o link recebido
 * após a compra consegue ver o pedido. Devolve só os campos necessários
 * para o cliente acompanhar — nunca dados de outros pedidos/clientes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const ref = String((await params).ref ?? '')
  if (!ref) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  const { data: order, error } = await (supabaseAdmin.from('orders') as any)
    .select(`
      id, order_number, status, payment_status, subtotal, delivery_fee, total,
      shipping_service, shipping_days, tracking_code, created_at, source,
      delivery_city, delivery_state
    `)
    .eq('catalog_checkout_ref', ref)
    .eq('source', 'catalog')
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  const { data: items } = await (supabaseAdmin.from('order_items') as any)
    .select('name, variant_label, quantity, unit_price, subtotal, variant_photo')
    .eq('order_id', order.id)

  return NextResponse.json({ order, items: items ?? [] })
}
