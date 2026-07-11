/**
 * Recalcula payment_status/paid_at de um pedido e total_purchases de um cliente
 * a partir do histórico de pagamentos (payment_history). Extraído de
 * app/(dashboard)/pedidos/page.tsx para ser reutilizado tanto pelo client
 * (mutations do módulo Pedidos) quanto por rotas server-side (webhook de
 * pagamento do Catálogo Online) — mesma regra de negócio nos dois lugares.
 *
 * Aceita qualquer client Supabase (browser client ou supabaseAdmin) — o
 * chamador decide qual instância usar.
 */

type AnySupabaseClient = any

/** Recalcula payment_status + paid_at do pedido a partir do SUM atual do payment_history. */
export async function recalcOrderPaymentStatus(
  supabase: AnySupabaseClient,
  orderId: string,
  companyId: string,
  orderTotalValue: number,
  currentPaidAt: string | null
): Promise<string> {
  const { data: rows } = await supabase.from('payment_history')
    .select('amount')
    .eq('order_id', orderId)
    .eq('company_id', companyId)
  const total = (rows ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)

  let status: string
  if (orderTotalValue > 0 && total >= orderTotalValue) status = 'paid'
  else if (total > 0) status = 'partial'
  else status = 'pending'

  const isPaid = status === 'paid'
  await supabase.from('orders')
    .update({
      payment_status: status,
      paid_at: isPaid ? (currentPaidAt ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  return status
}

/** Recalcula total_purchases do cliente somando apenas pedidos 100% pagos. */
export async function recalcCustomerTotalPurchases(
  supabase: AnySupabaseClient,
  customerId: string,
  companyId: string
): Promise<void> {
  const { data: clientOrders } = await supabase.from('orders')
    .select('total')
    .eq('customer_id', customerId)
    .eq('company_id', companyId)
    .eq('payment_status', 'paid')
  const totalPurchases = (clientOrders ?? []).reduce((s: number, o: any) => s + Number(o.total), 0)
  await supabase.from('customers')
    .update({ total_purchases: totalPurchases, updated_at: new Date().toISOString() })
    .eq('id', customerId)
}
