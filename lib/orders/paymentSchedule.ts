/**
 * Geração das parcelas de Contas a Receber (payment_schedule) de um
 * pedido a partir da seção "Financeiro" do formulário. Puramente
 * determinístico — sem chamadas de rede — para poder ser usado tanto na
 * prévia exibida no formulário quanto no momento de salvar o pedido.
 */

import { addMonths, format } from 'date-fns'

export type OrderPaymentMethod =
  | 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito'
  | 'boleto' | 'transferencia' | 'crediario' | 'outro'

export const ORDER_PAYMENT_METHODS: { value: OrderPaymentMethod; label: string }[] = [
  { value: 'dinheiro',       label: 'Dinheiro' },
  { value: 'pix',            label: 'Pix' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito',  label: 'Cartão de Débito' },
  { value: 'boleto',         label: 'Boleto' },
  { value: 'transferencia',  label: 'Transferência' },
  { value: 'crediario',      label: 'Crediário' },
  { value: 'outro',          label: 'Outro' },
]

/** Métodos em que faz sentido perguntar "recebido agora?" (pagamento à vista). */
export const IMMEDIATE_CAPABLE_METHODS: OrderPaymentMethod[] = [
  'dinheiro', 'pix', 'cartao_debito', 'transferencia', 'outro',
]

export const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra']

export interface ScheduleDraftRow {
  installment_number: number
  installment_count:  number
  due_date:            string
  amount:               number
  payment_method:       OrderPaymentMethod
  card_brand?:          string | null
  card_fee_percent?:    number | null
  boleto_number?:       string | null
  notes?:               string | null
}

export interface FinanceFormInput {
  payment_method:          OrderPaymentMethod
  total:                    number
  /** dinheiro / pix / cartao_debito / transferencia / outro */
  receivedNow?:             boolean
  receivedDate?:            string
  dueDate?:                 string
  /** cartao_credito */
  cardBrand?:               string
  cardInstallments?:        number
  cardFeePercent?:          number
  cardFirstReceiptDate?:    string
  /** boleto */
  boletoNumber?:            string
  notes?:                   string
  /** crediário */
  crediarioInstallments?:   number
  crediarioFirstDueDate?:   string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function buildEqualInstallments(
  total: number,
  count: number,
  firstDueISO: string,
  method: OrderPaymentMethod,
  extra: Partial<Pick<ScheduleDraftRow, 'card_brand' | 'card_fee_percent'>> = {},
): ScheduleDraftRow[] {
  const n = Math.max(1, Math.floor(count) || 1)
  const base = Math.floor((total / n) * 100) / 100
  const firstDue = new Date(firstDueISO + 'T00:00:00')
  let allocated = 0
  const rows: ScheduleDraftRow[] = []
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1
    const amount = isLast ? round2(total - allocated) : base
    allocated += amount
    rows.push({
      installment_number: i + 1,
      installment_count:  n,
      due_date:            format(addMonths(firstDue, i), 'yyyy-MM-dd'),
      amount,
      payment_method:      method,
      ...extra,
    })
  }
  return rows
}

/**
 * Constrói as parcelas de recebimento a partir da seção Financeiro do
 * pedido. Não decide se o pagamento já foi recebido — isso é resolvido
 * depois, no caller, chamando registerSchedulePayment para a parcela
 * gerada quando `receivedNow` for true.
 */
export function buildPaymentScheduleDraft(input: FinanceFormInput): ScheduleDraftRow[] {
  const { payment_method, total } = input
  if (!(total > 0)) return []

  const today = format(new Date(), 'yyyy-MM-dd')

  if (payment_method === 'cartao_credito') {
    const n = Math.max(1, Math.floor(input.cardInstallments || 1))
    const firstDate = input.cardFirstReceiptDate || today
    const feePct = input.cardFeePercent || 0
    const netTotal = round2(total * (1 - feePct / 100))
    return buildEqualInstallments(netTotal, n, firstDate, payment_method, {
      card_brand:       input.cardBrand || null,
      card_fee_percent: feePct || null,
    })
  }

  if (payment_method === 'crediario') {
    const n = Math.max(1, Math.floor(input.crediarioInstallments || 1))
    const firstDate = input.crediarioFirstDueDate || today
    return buildEqualInstallments(total, n, firstDate, payment_method)
  }

  if (payment_method === 'boleto') {
    const dueDate = input.dueDate || today
    return [{
      installment_number: 1,
      installment_count:  1,
      due_date:            dueDate,
      amount:               round2(total),
      payment_method,
      boleto_number:        input.boletoNumber || null,
      notes:                input.notes || null,
    }]
  }

  // dinheiro / pix / cartao_debito / transferencia / outro
  const dueDate = input.receivedNow ? (input.receivedDate || today) : (input.dueDate || today)
  return [{
    installment_number: 1,
    installment_count:  1,
    due_date:            dueDate,
    amount:               round2(total),
    payment_method,
    notes:                input.notes || null,
  }]
}

/** "Dias restantes" / "dias para vencer" — negativo quando já venceu. */
export function daysUntil(dateISO: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateISO + 'T00:00:00')
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

export type ScheduleDisplayStatus = 'a_receber' | 'parcial' | 'recebido' | 'vencido' | 'cancelado'

/**
 * "Vencido" nunca é gravado no banco — é sempre derivado (status ainda
 * em aberto + due_date no passado), igual ao alerta de estoque crítico.
 * Evita precisar de cron para "atualizar status vencidos" toda noite.
 */
export function effectiveScheduleStatus(row: { status: string; due_date: string }): ScheduleDisplayStatus {
  if (row.status === 'recebido' || row.status === 'cancelado') return row.status
  if (daysUntil(row.due_date) < 0) return 'vencido'
  return row.status as 'a_receber' | 'parcial'
}

export const SCHEDULE_STATUS_LABELS: Record<ScheduleDisplayStatus, string> = {
  a_receber: 'A Receber',
  parcial:   'Parcial',
  recebido:  'Recebido',
  vencido:   'Vencido',
  cancelado: 'Cancelado',
}
