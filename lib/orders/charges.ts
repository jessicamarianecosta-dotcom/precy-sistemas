/**
 * Cobrança (order_charges) — status e valor exibidos são sempre
 * recalculados ao vivo a partir do saldo real do pedido (orders.total -
 * soma de payment_history), nunca a partir de um valor congelado na
 * criação. Isso garante que, em pagamentos parciais, a cobrança sempre
 * mostre o saldo restante correto (regra explícita do fluxo de
 * cobrança), sem precisar duplicar nenhum lançamento financeiro.
 *
 * Mesma função de status usada em Contas a Receber
 * (computeReceivableStatus), para a cobrança nunca divergir do que o
 * Financeiro já mostra para o pedido.
 */

import { computeReceivableStatus } from '@/lib/orders/receivables'

export type ChargeDisplayStatus = 'pendente' | 'vencida' | 'paga' | 'cancelada'

export interface ChargeDisplay {
  /** Valor ainda devido, limitado ao saldo real do pedido (nunca cobra mais do que falta). */
  amountDue: number
  /** Valor originalmente solicitado na criação da cobrança (para referência/histórico). */
  amountRequested: number
  status: ChargeDisplayStatus
  isSettled: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeChargeDisplay(params: {
  chargeAmount: number
  chargeStatus: 'ativa' | 'cancelada'
  dueDate: string
  orderTotal: number
  orderReceived: number
  orderStatus: string
  today?: string
}): ChargeDisplay {
  const orderBalance = round2(Math.max(0, params.orderTotal - params.orderReceived))

  if (params.chargeStatus === 'cancelada') {
    return { amountDue: 0, amountRequested: round2(params.chargeAmount), status: 'cancelada', isSettled: true }
  }

  if (orderBalance <= 0) {
    return { amountDue: 0, amountRequested: round2(params.chargeAmount), status: 'paga', isSettled: true }
  }

  const receivableStatus = computeReceivableStatus({
    total: params.orderTotal,
    received: params.orderReceived,
    dueDate: params.dueDate,
    orderStatus: params.orderStatus,
    today: params.today,
  })

  const amountDue = round2(Math.min(params.chargeAmount, orderBalance))
  const status: ChargeDisplayStatus = receivableStatus === 'vencido' ? 'vencida' : 'pendente'

  return { amountDue, amountRequested: round2(params.chargeAmount), status, isSettled: false }
}

export const CHARGE_STATUS_LABELS: Record<ChargeDisplayStatus, string> = {
  pendente:  'Pendente',
  vencida:   'Vencida',
  paga:      'Paga',
  cancelada: 'Cancelada',
}
