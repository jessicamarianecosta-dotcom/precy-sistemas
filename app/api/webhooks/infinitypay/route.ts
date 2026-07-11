import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPaymentAdapter } from '@/lib/catalog/payments'
import { recalcOrderPaymentStatus, recalcCustomerTotalPurchases } from '@/lib/orders/recalc'

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/infinitypay
 *
 * Confirma o pagamento de um pedido do Catálogo Online e dispara a cascata
 * automática nos demais módulos — o core do valor do módulo:
 *   1. payment_history + financial_transactions (mesma forma exata do
 *      "Registrar Recebimento" em app/(dashboard)/pedidos/page.tsx)
 *   2. recálculo de orders.payment_status/paid_at e customers.total_purchases
 *      (lib/orders/recalc.ts, extraído do mesmo módulo Pedidos)
 *   3. baixa de estoque via BOM (product_materials), quando o produto tiver
 *   4. evento em Agenda (calendar_tasks.linked_order_id — primeiro uso real
 *      dessa coluna, que já existia mas nunca era populada)
 *
 * Idempotente via orders.catalog_checkout_ref: se o pedido já estiver
 * pago, responde 200 sem reprocessar.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const adapter = getPaymentAdapter()

  const signature = req.headers.get('x-infinitypay-signature') ?? req.headers.get('signature')
  if (!adapter.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  let event
  try {
    event = adapter.parseWebhookEvent(rawBody)
  } catch (err: any) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  if (event.status !== 'paid') {
    return NextResponse.json({ received: true, status: event.status })
  }

  const { data: order, error: orderError } = await (supabaseAdmin.from('orders') as any)
    .select('id, company_id, customer_id, total, payment_status, paid_at, order_number')
    .eq('catalog_checkout_ref', event.ref)
    .single()

  if (orderError || !order) {
    console.warn('[webhook/infinitypay] pedido não encontrado para ref', event.ref)
    return NextResponse.json({ received: true, warning: 'Pedido não encontrado' })
  }

  /* ── Idempotência: já processado? ── */
  if (order.payment_status === 'paid') {
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }

  try {
    /* 1. payment_history + financial_transactions — mesma forma do módulo Pedidos */
    const { data: paymentHistory, error: phError } = await (supabaseAdmin.from('payment_history') as any)
      .insert([{
        order_id: order.id,
        customer_id: order.customer_id,
        company_id: order.company_id,
        amount: order.total,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: event.paymentMethod ?? 'infinitypay',
        observation: 'Pagamento via Catálogo Online',
        percentage: 100,
      }])
      .select('id')
      .single()
    if (phError) throw new Error(`payment_history: ${phError.message}`)

    const { error: ftError } = await (supabaseAdmin.from('financial_transactions') as any)
      .insert([{
        company_id: order.company_id,
        order_id: order.id,
        payment_history_id: paymentHistory?.id ?? null,
        type: 'income',
        category: 'vendas',
        amount: order.total,
        description: `Recebimento — Pedido ${order.order_number || ''} · Catálogo Online`,
        date: new Date().toISOString().slice(0, 10),
        status: 'received',
      }])
    if (ftError) throw new Error(`financial_transactions: ${ftError.message}`)

    /* 2. Recalcular payment_status/paid_at do pedido e total_purchases do cliente */
    await recalcOrderPaymentStatus(supabaseAdmin, order.id, order.company_id, Number(order.total), order.paid_at)
    if (order.customer_id) {
      await recalcCustomerTotalPurchases(supabaseAdmin, order.customer_id, order.company_id)
    }

    /* 3. Baixa de estoque via BOM (só quando o produto tiver product_materials) */
    const { data: items } = await (supabaseAdmin.from('order_items') as any)
      .select('product_id, quantity')
      .eq('order_id', order.id)

    for (const item of items ?? []) {
      if (!item.product_id) continue
      const { data: materials } = await (supabaseAdmin.from('product_materials') as any)
        .select('inventory_id, quantity')
        .eq('product_id', item.product_id)
        .not('inventory_id', 'is', null)

      for (const material of materials ?? []) {
        const { data: inv } = await (supabaseAdmin.from('inventory') as any)
          .select('quantity')
          .eq('id', material.inventory_id)
          .single()
        if (!inv) continue
        const newQuantity = Math.max(0, Number(inv.quantity) - Number(material.quantity) * Number(item.quantity))
        await (supabaseAdmin.from('inventory') as any)
          .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
          .eq('id', material.inventory_id)
      }
    }

    /* 4. Evento de entrega na Agenda, vinculado ao pedido */
    const firstItem = (items ?? [])[0]
    let leadTimeDays = 3
    if (firstItem?.product_id) {
      const { data: product } = await (supabaseAdmin.from('products') as any)
        .select('catalog_lead_time_days')
        .eq('id', firstItem.product_id)
        .single()
      if (product?.catalog_lead_time_days) leadTimeDays = product.catalog_lead_time_days
    }
    const deliveryDate = new Date()
    deliveryDate.setDate(deliveryDate.getDate() + leadTimeDays)

    await (supabaseAdmin.from('calendar_tasks') as any).insert([{
      company_id: order.company_id,
      title: `Entrega — Pedido ${order.order_number || ''}`,
      description: 'Pedido pago pelo Catálogo Online',
      date: deliveryDate.toISOString().slice(0, 10),
      category: 'delivery',
      status: 'pending',
      linked_order_id: order.id,
    }])

    return NextResponse.json({ received: true, orderId: order.id })
  } catch (err: any) {
    console.error('[webhook/infinitypay] processing error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 })
  }
}
