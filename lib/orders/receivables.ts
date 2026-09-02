/**
 * Fonte única de verdade para "quanto um pedido ainda tem a receber".
 *
 * Todo cálculo de status/saldo de Contas a Receber — Financeiro,
 * Dashboard, Pedidos — passa por aqui. Nunca deriva status a partir de
 * uma parcela isolada (payment_schedule.amount/received_amount): esses
 * campos descrevem só aquela parcela, e um pedido pode ter várias. O
 * valor do pedido e o quanto já entrou vêm sempre de orders.total e da
 * soma real de payment_history — a mesma soma que register_order_payment
 * já usa para decidir orders.payment_status — então as duas fontes
 * nunca podem divergir.
 */

import { format } from 'date-fns'

type SupabaseClient = any

export type ReceivableStatus = 'a_receber' | 'parcial' | 'recebido' | 'vencido' | 'cancelado'

export interface OrderReceivable {
  orderId:        string
  orderNumber:    string | null
  customerId:     string | null
  customerName:   string | null
  serviceName:    string | null
  total:          number
  received:       number
  balance:        number
  dueDate:        string | null
  paymentMethod:  string | null
  status:         ReceivableStatus
  orderStatus:    string
  paidAt:         string | null
  /** id da parcela em aberto mais antiga (FIFO) — passado como p_schedule_id ao registrar o recebimento. */
  nextScheduleId: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Regra de status, em ordem de prioridade:
 * 1. Pedido cancelado → Cancelado.
 * 2. Saldo zerado (recebido >= total) → Recebido.
 * 3. Saldo > 0 e vencimento já passou → Vencido (mesmo que parcial).
 * 4. Recebido > 0 → Parcial.
 * 5. Recebido = 0 → A Receber.
 */
export function computeReceivableStatus(params: {
  total:       number
  received:    number
  dueDate:     string | null
  orderStatus: string
  today?:       string
}): ReceivableStatus {
  if (params.orderStatus === 'cancelled') return 'cancelado'

  const balance = round2(params.total - params.received)
  if (balance <= 0) return 'recebido'

  const today = params.today ?? format(new Date(), 'yyyy-MM-dd')
  if (params.dueDate && params.dueDate < today) return 'vencido'

  if (params.received > 0) return 'parcial'
  return 'a_receber'
}

/**
 * Uma linha por PEDIDO (não por parcela): valor total, quanto já
 * entrou, saldo, vencimento e forma de pagamento da próxima parcela em
 * aberto, e status calculado por computeReceivableStatus.
 */
export async function fetchOrderReceivables(
  supabase: SupabaseClient,
  companyId: string,
): Promise<OrderReceivable[]> {
  const [{ data: orders }, { data: paymentsRaw }, { data: scheduleRaw }] = await Promise.all([
    supabase.from('orders')
      .select('id, order_number, total, status, payment_method, service_name, customer_id, paid_at, customers(name)')
      .eq('company_id', companyId),
    supabase.from('payment_history')
      .select('order_id, amount')
      .eq('company_id', companyId),
    supabase.from('payment_schedule')
      .select('id, order_id, due_date, payment_method, status, installment_number')
      .eq('company_id', companyId)
      .order('due_date', { ascending: true }),
  ])

  const receivedByOrder: Record<string, number> = {}
  ;(paymentsRaw ?? []).forEach((p: any) => {
    receivedByOrder[p.order_id] = (receivedByOrder[p.order_id] ?? 0) + Number(p.amount)
  })

  /* Primeira parcela ainda em aberto de cada pedido (já ordenado por due_date). */
  const nextOpenByOrder: Record<string, { id: string; due_date: string; payment_method: string; installment_number: number }> = {}
  ;(scheduleRaw ?? []).forEach((r: any) => {
    if (r.status === 'recebido' || r.status === 'cancelado') return
    const current = nextOpenByOrder[r.order_id]
    if (!current || r.installment_number < current.installment_number) {
      nextOpenByOrder[r.order_id] = {
        id: r.id, due_date: r.due_date, payment_method: r.payment_method, installment_number: r.installment_number,
      }
    }
  })

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (orders ?? []).map((o: any) => {
    const total    = round2(Number(o.total))
    const received = round2(Math.min(total, receivedByOrder[o.id] ?? 0))
    const balance  = round2(total - received)
    const next     = nextOpenByOrder[o.id]

    return {
      orderId:        o.id,
      orderNumber:    o.order_number ?? null,
      customerId:     o.customer_id ?? null,
      customerName:   o.customers?.name ?? null,
      serviceName:    o.service_name ?? null,
      total,
      received,
      balance,
      dueDate:        next?.due_date ?? null,
      paymentMethod:  next?.payment_method ?? o.payment_method ?? null,
      orderStatus:    o.status,
      paidAt:         o.paid_at ?? null,
      nextScheduleId: next?.id ?? null,
      status: computeReceivableStatus({
        total, received, dueDate: next?.due_date ?? null, orderStatus: o.status, today: todayStr,
      }),
    } satisfies OrderReceivable
  })
}
