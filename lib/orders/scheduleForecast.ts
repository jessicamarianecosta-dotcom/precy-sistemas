/**
 * Previsão de receitas do Financeiro: converte as parcelas em aberto de
 * payment_schedule (cartão parcelado, boleto, crediário, à vista a receber)
 * em linhas de receita "previstas", datadas pelo vencimento da parcela e
 * valoradas pelo SALDO pendente (amount - received_amount).
 *
 * Fica fora de financial_transactions de propósito: lá só entra dinheiro
 * que realmente entrou (register_order_payment). Estas linhas são derivadas
 * a cada consulta, então nunca duplicam nem ficam desatualizadas.
 */

export interface ScheduleForecastRow {
  id:              string
  type:            'income'
  category:        string
  amount:          number
  description:     string
  date:            string
  status:          'pending' | 'partial' | 'overdue'
  client_name:     string | null
  order_id:        string
  payment_method:  string | null
  installment_number: number
  installments:    number
  forecast:        true
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function buildScheduleForecast(
  scheduleRows: any[],
  /** Pedidos que já têm lançamento de receita pendente em financial_transactions — evita contar duas vezes. */
  orderIdsWithPendingIncome: Set<string>,
  todayISO: string,
): ScheduleForecastRow[] {
  const out: ScheduleForecastRow[] = []
  for (const r of scheduleRows) {
    if (r.status === 'cancelado' || r.status === 'recebido') continue
    const order = r.orders
    if (!order || order.status === 'cancelled') continue
    if (orderIdsWithPendingIncome.has(r.order_id)) continue

    const amount   = round2(Number(r.amount))
    const received = round2(Number(r.received_amount) || 0)
    const balance  = round2(amount - received)
    if (!(balance > 0) || !r.due_date) continue

    const count = r.installment_count ?? 1
    const label = count > 1 ? `Parcela ${r.installment_number}/${count} — ` : ''
    out.push({
      id:          `sched:${r.id}`,
      type:        'income',
      category:    'pedidos',
      amount:      balance,
      description: `${label}Pedido ${order.order_number ?? ''}${order.service_name ? ' · ' + order.service_name : ''}`.trim(),
      date:        r.due_date,
      status:      r.due_date < todayISO ? 'overdue' : received > 0 ? 'partial' : 'pending',
      client_name: order.customers?.name ?? null,
      order_id:    r.order_id,
      payment_method:     r.payment_method ?? null,
      installment_number: r.installment_number,
      installments:       count,
      forecast:    true,
    })
  }
  return out
}
