import { supabaseAdmin } from '@/lib/supabase/admin'
import { recalcOrderPaymentStatus, recalcCustomerTotalPurchases } from './recalc'
import type { PaymentWebhookEvent } from '@/lib/catalog/payments/types'

export type CatalogPaymentCascadeResult =
  | { ok: true; orderId: string }
  | { ok: true; alreadyProcessed: true }
  | { ok: false; status: 'not_found'; warning: string }
  | { ok: false; status: 'error'; error: string }

/**
 * Executa a cascata pós-pagamento de um pedido do Catálogo Online — comum a
 * qualquer gateway de pagamento (hoje só Mercado Pago, mas a mesma lógica
 * valia para a InfinityPay antes dela): registra o recebimento no
 * Financeiro, recalcula status do pedido e total de compras do cliente, dá
 * baixa de estoque (via BOM e via variação) e cria o evento de entrega na
 * Agenda. Extraído do webhook original de um único gateway (InfinityPay)
 * para não duplicar ~130 linhas de regra de negócio por integração nova.
 *
 * Idempotência: payment_history.catalog_checkout_ref tem UNIQUE constraint
 * (migration 048) e É a trava atômica — se o gateway reenviar o mesmo
 * evento (comum em timeout), o INSERT dentro de register_order_payment
 * falha com 23505 e é tratado como "já processado", sem duplicar nada.
 *
 * Passos de estoque e agenda são best-effort: falham silenciosamente (log
 * apenas) sem derrubar o resultado, porque o pagamento em si já foi gravado
 * com sucesso quando eles rodam — devolver erro aqui faria o gateway
 * reenviar, e o reenvio cairia direto no "já processado" (idempotência do
 * passo de pagamento), nunca tentando estoque/agenda de novo.
 */
export async function applyCatalogPaymentConfirmed(
  event: PaymentWebhookEvent,
  gatewayLabel: string,
): Promise<CatalogPaymentCascadeResult> {
  const { data: order, error: orderError } = await (supabaseAdmin.from('orders') as any)
    .select('id, company_id, customer_id, total, paid_at, order_number, customers(name)')
    .eq('catalog_checkout_ref', event.ref)
    .single()

  if (orderError || !order) {
    return { ok: false, status: 'not_found', warning: 'Pedido não encontrado' }
  }

  const { error: rpcError } = await (supabaseAdmin.rpc as any)('register_order_payment', {
    p_order_id: order.id,
    p_company_id: order.company_id,
    p_customer_id: order.customer_id,
    p_amount: order.total,
    p_payment_date: new Date().toISOString().slice(0, 10),
    p_payment_method: event.paymentMethod ?? gatewayLabel,
    p_observation: 'Pagamento via Catálogo Online',
    p_percentage: 100,
    p_order_number: order.order_number || '',
    p_service_name: 'Catálogo Online',
    p_client_name: order.customers?.name ?? null,
    p_created_by: null,
    p_catalog_checkout_ref: event.ref,
  })

  if (rpcError) {
    if (rpcError.code === '23505') return { ok: true, alreadyProcessed: true }
    return { ok: false, status: 'error', error: rpcError.message }
  }

  try {
    await recalcOrderPaymentStatus(supabaseAdmin, order.id, order.company_id, Number(order.total), order.paid_at)
    if (order.customer_id) {
      await recalcCustomerTotalPurchases(supabaseAdmin, order.customer_id, order.company_id)
    }
  } catch (err: any) {
    return { ok: false, status: 'error', error: err?.message ?? 'Erro ao processar pagamento' }
  }

  const { data: items } = await (supabaseAdmin.from('order_items') as any)
    .select('product_id, variant_id, quantity')
    .eq('order_id', order.id)

  /* Baixa de estoque via BOM (matéria-prima) — best-effort */
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
    console.error(`[catalog-payment/${gatewayLabel}] baixa de estoque (BOM) falhou (pagamento já registrado):`, err?.message ?? err)
  }

  /* Baixa de estoque por VARIAÇÃO (product_variants.stock_quantity) — conceito
     separado do BOM acima: estoque de produto acabado por combinação, não
     consumo de insumo para custo. Best-effort, mesmo padrão. */
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
    console.error(`[catalog-payment/${gatewayLabel}] baixa de estoque de variação falhou (pagamento já registrado):`, err?.message ?? err)
  }

  /* Evento de entrega na Agenda — best-effort */
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
    console.error(`[catalog-payment/${gatewayLabel}] criação do evento de agenda falhou (pagamento já registrado):`, err?.message ?? err)
  }

  return { ok: true, orderId: order.id }
}
