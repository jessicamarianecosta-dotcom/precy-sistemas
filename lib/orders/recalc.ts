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

/**
 * Registra um recebimento contra uma parcela de payment_schedule (Contas
 * a Receber) — ou sem parcela nenhuma, quando scheduleId é omitido,
 * mesmo comportamento de sempre. Usa a mesma RPC atômica
 * register_order_payment do webhook do Catálogo Online; a reconciliação
 * da parcela (received_amount/status) acontece dentro da própria função
 * SQL, então não há passo extra a esquecer aqui.
 */
export async function registerSchedulePayment(
  supabase: AnySupabaseClient,
  params: {
    orderId:      string
    companyId:    string
    customerId:   string | null
    amount:       number
    paymentDate:  string
    paymentMethod: string | null
    observation?:  string | null
    percentage?:   number | null
    orderNumber?:  string | null
    serviceName?:  string | null
    clientName?:   string | null
    createdBy?:    string | null
    scheduleId?:   string | null
  }
): Promise<string> {
  const { data: paymentId, error } = await supabase.rpc('register_order_payment', {
    p_order_id:       params.orderId,
    p_company_id:     params.companyId,
    p_customer_id:    params.customerId,
    p_amount:         params.amount,
    p_payment_date:   params.paymentDate,
    p_payment_method: params.paymentMethod,
    p_observation:    params.observation ?? null,
    p_percentage:     params.percentage ?? null,
    p_order_number:   params.orderNumber ?? null,
    p_service_name:   params.serviceName ?? null,
    p_client_name:    params.clientName ?? null,
    p_created_by:     params.createdBy ?? null,
    p_schedule_id:    params.scheduleId ?? null,
  })
  if (error) throw error
  return paymentId as string
}

/**
 * Substitui o plano de recebimento (payment_schedule) de um pedido pelo
 * gerado a partir da seção Financeiro do formulário. Só regenera quando
 * NENHUMA parcela existente já recebeu algo — uma vez que o cliente
 * começou a pagar sob um plano, editar o pedido não apaga esse
 * histórico nem reembaralha os números de parcela; a forma de
 * pagamento só volta a ser editável parcela a parcela, no card
 * Financeiro do pedido.
 */
export async function syncOrderPaymentSchedule(
  supabase: AnySupabaseClient,
  params: {
    orderId:    string
    companyId:  string
    customerId: string | null
    rows: Array<{
      installment_number: number
      installment_count:  number
      due_date:             string
      amount:                number
      payment_method:        string
      card_brand?:           string | null
      card_fee_percent?:     number | null
      boleto_number?:        string | null
      notes?:                 string | null
    }>
  }
): Promise<{ applied: boolean }> {
  const { data: existing } = await supabase.from('payment_schedule')
    .select('id, received_amount')
    .eq('order_id', params.orderId)

  const hasReceivedSomething = (existing ?? []).some((r: any) => Number(r.received_amount) > 0)
  if (hasReceivedSomething) return { applied: false }

  if (existing && existing.length > 0) {
    await supabase.from('payment_schedule').delete().eq('order_id', params.orderId)
  }

  if (params.rows.length === 0) return { applied: true }

  await supabase.from('payment_schedule').insert(
    params.rows.map(r => ({
      company_id:         params.companyId,
      order_id:            params.orderId,
      customer_id:          params.customerId,
      installment_number:   r.installment_number,
      installment_count:    r.installment_count,
      due_date:              r.due_date,
      amount:                r.amount,
      payment_method:        r.payment_method,
      card_brand:            r.card_brand ?? null,
      card_fee_percent:      r.card_fee_percent ?? null,
      boleto_number:          r.boleto_number ?? null,
      notes:                  r.notes ?? null,
    }))
  )

  return { applied: true }
}
