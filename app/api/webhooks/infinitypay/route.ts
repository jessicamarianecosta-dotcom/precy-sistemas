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
 * Idempotência: payment_history.catalog_checkout_ref tem UNIQUE constraint
 * (migration 048) e É a trava atômica — se dois envios do mesmo evento
 * chegarem simultaneamente (comum em gateways que reenviam em timeout), o
 * segundo INSERT falha com 23505 e é tratado como "já processado". Isso
 * evita a condição de corrida de checar `orders.payment_status` antes do
 * primeiro envio terminar de gravar.
 *
 * Passos 3 (estoque) e 4 (agenda) são best-effort: falham silenciosamente
 * (log apenas) sem derrubar a resposta 200, porque o pagamento em si (passo
 * 1-2) já foi gravado com sucesso quando eles rodam — devolver 500 aqui
 * faria o gateway reenviar, e o reenvio cairia direto no "já processado"
 * (idempotência do passo 1), nunca tentando estoque/agenda de novo.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  let adapter
  try {
    adapter = getPaymentAdapter()
  } catch (err: any) {
    console.error('[webhook/infinitypay] adapter indisponível:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Pagamentos indisponíveis' }, { status: 500 })
  }

  // Modo mock não verifica assinatura de verdade (qualquer POST com um ref
  // válido confirma o pagamento) — só é alcançável fora de produção
  // (getPaymentAdapter já falha explicitamente em produção sem credenciais).
  if (!process.env.INFINITYPAY_API_KEY) {
    console.warn('[webhook/infinitypay] INFINITYPAY_API_KEY ausente — rodando em modo mock, sem verificação real de assinatura')
  }

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
    .select('id, company_id, customer_id, total, paid_at, order_number, customers(name)')
    .eq('catalog_checkout_ref', event.ref)
    .single()

  if (orderError || !order) {
    console.warn('[webhook/infinitypay] pedido não encontrado para ref', event.ref)
    return NextResponse.json({ received: true, warning: 'Pedido não encontrado' })
  }

  /* payment_history + financial_transactions atomicamente (RPC
     register_order_payment) — o INSERT com catalog_checkout_ref único
     dentro da função É a trava de idempotência; se um reenvio do gateway
     cair aqui de novo, a violação de unique constraint aborta a função
     inteira (nenhum lançamento financeiro duplicado é criado). */
  const { error: rpcError } = await (supabaseAdmin.rpc as any)('register_order_payment', {
    p_order_id: order.id,
    p_company_id: order.company_id,
    p_customer_id: order.customer_id,
    p_amount: order.total,
    p_payment_date: new Date().toISOString().slice(0, 10),
    p_payment_method: event.paymentMethod ?? 'infinitypay',
    p_observation: 'Pagamento via Catálogo Online',
    p_percentage: 100,
    p_order_number: order.order_number || '',
    p_service_name: 'Catálogo Online',
    p_client_name: order.customers?.name ?? null,
    p_created_by: null,
    p_catalog_checkout_ref: event.ref,
  })

  if (rpcError) {
    if (rpcError.code === '23505') {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }
    console.error('[webhook/infinitypay] register_order_payment error:', rpcError.message)
    return NextResponse.json({ error: 'Erro ao registrar pagamento' }, { status: 500 })
  }

  try {
    /* Recalcular payment_status/paid_at do pedido e total_purchases do cliente */
    await recalcOrderPaymentStatus(supabaseAdmin, order.id, order.company_id, Number(order.total), order.paid_at)
    if (order.customer_id) {
      await recalcCustomerTotalPurchases(supabaseAdmin, order.customer_id, order.company_id)
    }
  } catch (err: any) {
    console.error('[webhook/infinitypay] processing error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 })
  }

  /* 3. Baixa de estoque via BOM — best-effort, não derruba a resposta */
  const { data: items } = await (supabaseAdmin.from('order_items') as any)
    .select('product_id, variant_id, quantity')
    .eq('order_id', order.id)

  try {
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
  } catch (err: any) {
    console.error('[webhook/infinitypay] baixa de estoque falhou (pagamento já registrado):', err?.message ?? err)
  }

  /* 3b. Baixa de estoque por VARIAÇÃO (product_variants.stock_quantity) — conceito
     novo e totalmente separado do BOM/matéria-prima acima: aqui é estoque de
     produto acabado por combinação (ex: "Azul · 1000un: 5 restantes"), não
     consumo de insumo para custo. Best-effort, mesmo padrão dos demais passos. */
  try {
    for (const item of items ?? []) {
      if (!item.variant_id) continue
      const { data: variant } = await (supabaseAdmin.from('product_variants') as any)
        .select('stock_quantity')
        .eq('id', item.variant_id)
        .single()
      if (!variant || variant.stock_quantity == null) continue
      const newQty = Math.max(0, Number(variant.stock_quantity) - Number(item.quantity))
      await (supabaseAdmin.from('product_variants') as any)
        .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', item.variant_id)
    }
  } catch (err: any) {
    console.error('[webhook/infinitypay] baixa de estoque de variação falhou (pagamento já registrado):', err?.message ?? err)
  }

  /* 4. Evento de entrega na Agenda — best-effort, não derruba a resposta */
  try {
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
  } catch (err: any) {
    console.error('[webhook/infinitypay] criação do evento de agenda falhou (pagamento já registrado):', err?.message ?? err)
  }

  return NextResponse.json({ received: true, orderId: order.id })
}
