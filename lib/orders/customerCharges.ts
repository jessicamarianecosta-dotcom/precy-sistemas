/**
 * Aviso de cobrança agregado por CLIENTE — soma os saldos de vários
 * pedidos em aberto num único documento/Pix. Mesma regra de
 * `computeChargeDisplay` (lib/orders/charges.ts), só que aplicada a uma
 * lista de pedidos: o valor e a situação exibidos são sempre
 * recalculados ao vivo a partir do saldo real de cada pedido incluído
 * (orders.total - soma de payment_history), nunca de um total
 * congelado na criação — assim um pagamento feito em qualquer um dos
 * pedidos incluídos atualiza o aviso automaticamente, sem duplicar
 * nenhum lançamento financeiro.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface CustomerChargeOrderInput {
  orderId: string
  orderNumber: string | null
  serviceName: string | null
  total: number
  received: number
  orderStatus: string
}

export interface CustomerChargeOrderLine {
  orderId: string
  orderNumber: string | null
  serviceName: string | null
  total: number
  received: number
  /** Saldo ainda em aberto deste pedido, nunca negativo. */
  balance: number
  /** Pedido cancelado ou já totalmente recebido — não entra na soma e aparece como "fora do aviso". */
  settled: boolean
}

export type CustomerChargeDisplayStatus = 'pendente' | 'vencida' | 'paga' | 'cancelada'

export interface CustomerChargeDisplay {
  orders: CustomerChargeOrderLine[]
  /** Soma dos saldos em aberto dos pedidos ainda não quitados/cancelados. */
  amountDue: number
  amountRequested: number
  status: CustomerChargeDisplayStatus
  isSettled: boolean
}

export function computeCustomerChargeDisplay(params: {
  chargeAmount: number
  chargeStatus: 'ativa' | 'cancelada'
  dueDate: string
  orders: CustomerChargeOrderInput[]
  today?: string
}): CustomerChargeDisplay {
  const today = params.today ?? new Date().toISOString().slice(0, 10)

  const orderLines: CustomerChargeOrderLine[] = params.orders.map(o => {
    const total = round2(o.total)
    const received = round2(Math.min(total, o.received))
    const balanceRaw = round2(total - received)
    const settled = o.orderStatus === 'cancelled' || balanceRaw <= 0
    return {
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      serviceName: o.serviceName,
      total,
      received,
      balance: settled ? 0 : balanceRaw,
      settled,
    }
  })

  const amountDue = round2(orderLines.reduce((s, o) => s + o.balance, 0))
  const amountRequested = round2(params.chargeAmount)

  if (params.chargeStatus === 'cancelada') {
    return { orders: orderLines, amountDue: 0, amountRequested, status: 'cancelada', isSettled: true }
  }

  if (amountDue <= 0) {
    return { orders: orderLines, amountDue: 0, amountRequested, status: 'paga', isSettled: true }
  }

  const status: CustomerChargeDisplayStatus = params.dueDate < today ? 'vencida' : 'pendente'

  return { orders: orderLines, amountDue, amountRequested, status, isSettled: false }
}

export const CUSTOMER_CHARGE_STATUS_LABELS: Record<CustomerChargeDisplayStatus, string> = {
  pendente:  'Pendente',
  vencida:   'Vencida',
  paga:      'Paga',
  cancelada: 'Cancelada',
}
