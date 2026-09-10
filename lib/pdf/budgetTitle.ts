/**
 * Título de exibição do orçamento: "Orçamento #1067 — Sipal".
 *
 * NUNCA usar o nome da empresa aqui — o identificador interno
 * (budgets.budget_number, ex. "ORC-1067") continua intacto em todo o
 * resto do sistema; isto só troca o texto exibido/impresso.
 */
export function formatBudgetTitle(
  budgetNumber?: string | null,
  customerName?: string | null,
): string {
  const num = String(budgetNumber ?? '').trim()
  const display = num ? '#' + num.replace(/^ORC-?/i, '') : '#—'
  const name = String(customerName ?? '').trim()
  return name ? `Orçamento ${display} — ${name}` : `Orçamento ${display}`
}
