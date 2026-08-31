/* ============================================================
   PRECY+ — Adaptador Pedido → Orçamento

   Converte um registro de `orders` (com a relação `customers`) para o
   formato esperado por `generateBudgetPDF`, permitindo baixar o orçamento
   de um pedido SEM criar um registro em `budgets`.

   Usa apenas colunas que existem de fato em `orders`:
   order_number, order_date/created_at, status, notes, payment_method,
   signal_amount, subtotal, discount, delivery_fee, additional_charges,
   total, due_date.
   ============================================================ */

import { toSlug } from '@/lib/utils/slug'
import { PICKUP_ADDRESS_TEXT } from '@/lib/constants/pickupAddress'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  crediario: 'Crediário',
  outro: 'Outro',
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch {
    return ''
  }
}

/** Mapeia o pedido para o "budget" que `generateBudgetPDF` consome. */
export function orderToBudgetShape(order: Record<string, unknown>): Record<string, unknown> {
  const o = order as any
  const rawMethod = o.payment_method ? String(o.payment_method) : ''
  const method = rawMethod
    ? (PAYMENT_METHOD_LABELS[rawMethod] ?? rawMethod)
    : ''
  const signal = Number(o.signal_amount) || 0
  const due = fmtDate(o.due_date)

  return {
    budget_number: o.order_number ?? 'PEDIDO',
    created_at: o.order_date ?? o.created_at ?? null,
    valid_until: null,
    status: o.status === 'cancelled' ? 'rejected' : 'approved',
    notes: o.notes ?? '',

    payment_method: method,
    pay_condition: signal > 0 ? 'entrada' : '',
    installments: 0,
    signal_amount: signal,

    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    delivery_fee: o.delivery_type === 'pickup' ? 0 : (Number(o.delivery_fee) || 0),
    additional_charges: Number(o.additional_charges) || 0,
    total: Number(o.total) || 0,

    // Modalidade de entrega herdada do pedido (colunas orders.delivery_* — migration 078).
    // Retirada usa sempre o endereço fixo da LumiLife.
    delivery_type: o.delivery_type ?? '',
    delivery_addr: o.delivery_type === 'pickup'
      ? PICKUP_ADDRESS_TEXT
      : (o.delivery_addr ?? ''),

    // Pedidos não possuem prazo de produção próprio — só o prazo de entrega (due_date).
    delivery_days: due,

    customers: o.customers ?? {},
  }
}

/** Nome de arquivo sugerido: orcamento-PED-1174-miguel.pdf */
export function orderQuoteFileName(order: Record<string, unknown>): string {
  const o = order as any
  const num = String(o.order_number ?? 'pedido').trim()
  const cust = (o.customers as any) ?? {}
  const name = toSlug(String(cust.name ?? '')).slice(0, 40)
  return ['orcamento', num, name].filter(Boolean).join('-')
}
