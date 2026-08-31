/* ============================================================
   PRECY+ — Adaptador Pedido → Orçamento

   Converte um registro de `orders` (com a relação `customers`) para o
   formato esperado por `generateBudgetPDF`, permitindo baixar o orçamento
   de um pedido SEM criar um registro em `budgets`.

   Usa apenas colunas que existem de fato em `orders`:
   order_number, order_date/created_at, status, notes, payment_method,
   signal_amount, subtotal, discount, delivery_fee, additional_charges,
   total, due_date.

   `orders` NÃO tem colunas de entrega. Quando o pedido veio de um orçamento
   (order.quote_id), a modalidade/endereço/prazos de entrega são lidos do
   orçamento de origem (`sourceBudget`) — sem duplicar dados no pedido.
   Retirada: o endereço é o da PRÓPRIA empresa (resolvido no generateBudgetPDF
   a partir de `company`), nunca um endereço global.
   ============================================================ */

import { toSlug } from '@/lib/utils/slug'

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

/**
 * Mapeia o pedido para o "budget" que `generateBudgetPDF` consome.
 *
 * @param order        registro de `orders` (com relação `customers`)
 * @param sourceBudget orçamento de origem (order.quote_id), quando existir —
 *                     fonte da modalidade/endereço/prazos de entrega.
 */
export function orderToBudgetShape(
  order: Record<string, unknown>,
  sourceBudget?: Record<string, unknown> | null,
): Record<string, unknown> {
  const o = order as any
  const sb = (sourceBudget ?? {}) as any
  const rawMethod = o.payment_method ? String(o.payment_method) : ''
  const method = rawMethod
    ? (PAYMENT_METHOD_LABELS[rawMethod] ?? rawMethod)
    : ''
  const signal = Number(o.signal_amount) || 0
  const due = fmtDate(o.due_date)

  const deliveryType = String(sb.delivery_type ?? '')
  const isPickupType = deliveryType === 'pickup'
  // Retirada: endereço resolvido pelo generateBudgetPDF a partir de `company`.
  // Demais modalidades: usa o endereço que o orçamento gravou.

  return {
    budget_number: o.order_number ?? 'PEDIDO',
    created_at: o.order_date ?? o.created_at ?? null,
    valid_until: sb.valid_until ?? null,
    status: o.status === 'cancelled' ? 'rejected' : 'approved',
    notes: o.notes ?? '',

    // Pagamento: valores atuais do pedido têm prioridade; condição/prazo herdam do orçamento.
    payment_method: method || String(sb.payment_method ?? ''),
    pay_condition: sb.pay_condition ?? (signal > 0 ? 'entrada' : ''),
    installments: Number(sb.installments) || 0,
    signal_amount: signal,
    prazo_type: sb.prazo_type ?? '',
    prazo_dias: Number(sb.prazo_dias) || 0,
    prazo_due_date: sb.prazo_due_date ?? null,

    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    delivery_fee: isPickupType ? 0 : (Number(o.delivery_fee) || Number(sb.delivery_fee) || 0),
    additional_charges: Number(o.additional_charges) || 0,
    total: Number(o.total) || 0,

    // Entrega: lida do orçamento de origem. Retirada → generateBudgetPDF resolve
    // o endereço a partir de `company` (endereço da própria empresa).
    delivery_type: deliveryType,
    delivery_addr: isPickupType ? '' : (sb.delivery_addr ?? ''),
    delivery_days: sb.delivery_days || due,
    production_days: sb.production_days ?? '',

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
