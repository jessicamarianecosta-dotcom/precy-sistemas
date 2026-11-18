import { formatBRL, formatDateBR } from '@/lib/precyflow/format'
import { BUDGET_STATUS_LABELS } from '@/lib/precyflow/types'
import type { PrecyFlowBudget, PrecyFlowStore } from '@/lib/precyflow/types'

/* Gera o PDF do orçamento abrindo uma janela de impressão (Ctrl+P → "Salvar
   como PDF"), o mesmo princípio usado pelo orçamento público do Precy+
   (lib/pdf/budgetPrintTemplate.ts) — evita depender de layout manual com
   jsPDF para uma tabela com fotos, que o navegador já faz bem via HTML/CSS. */
export function printBudget(budget: PrecyFlowBudget, store: PrecyFlowStore) {
  const win = window.open('', '_blank', 'width=800,height=1000')
  if (!win) return

  win.document.write(renderBudgetHTML(budget, store))
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

function renderBudgetHTML(budget: PrecyFlowBudget, store: PrecyFlowStore): string {
  const customerName = Array.isArray(budget.customer) ? (budget.customer[0] as { name: string } | undefined)?.name : budget.customer?.name

  const rows = (budget.items ?? []).map(item => `
    <tr>
      <td class="photo">${item.image_url ? `<img src="${escapeAttr(item.image_url)}" alt="" />` : ''}</td>
      <td>${escapeHtml(item.description)}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${formatBRL(item.unit_price)}</td>
      <td class="num">${formatBRL(item.subtotal)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Orçamento ${escapeHtml(budget.budget_number)} - ${escapeHtml(store.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #2C2018; margin: 0; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #D6447D; padding-bottom: 16px; }
  .store-name { font-size: 22px; font-weight: 800; color: #4A2E3A; }
  .store-name span { color: #D6447D; }
  .meta { text-align: right; font-size: 13px; color: #7A6855; }
  .title { font-size: 16px; font-weight: 700; margin: 24px 0 8px; }
  .customer { font-size: 14px; margin-bottom: 20px; color: #4A2E3A; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #7A6855; padding: 8px; border-bottom: 1px solid #EDE8E2; }
  td { padding: 10px 8px; font-size: 13px; border-bottom: 1px solid #F4EFE9; vertical-align: middle; }
  td.num { text-align: right; }
  td.photo img { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; }
  .totals { display: flex; justify-content: flex-end; }
  .totals table { width: 280px; }
  .totals td { border: none; padding: 4px 8px; }
  .totals .total-row td { font-size: 16px; font-weight: 700; color: #D6447D; border-top: 2px solid #D6447D; padding-top: 10px; }
  .conditions { margin-top: 24px; font-size: 12px; color: #7A6855; white-space: pre-wrap; }
  .footer { margin-top: 32px; font-size: 11px; color: #B8A898; text-align: center; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="store-name">${escapeHtml(store.name)}</div>
    <div class="meta">
      Orçamento #${escapeHtml(budget.budget_number)}<br/>
      Status: ${BUDGET_STATUS_LABELS[budget.status]}<br/>
      Válido até: ${budget.valid_until ? formatDateBR(budget.valid_until) : '—'}
    </div>
  </div>

  <div class="title">Cliente</div>
  <div class="customer">${escapeHtml(customerName ?? '—')}</div>

  <table>
    <thead>
      <tr><th></th><th>Item</th><th class="num">Qtd.</th><th class="num">Valor un.</th><th class="num">Subtotal</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td class="num">${formatBRL(budget.subtotal)}</td></tr>
      ${budget.discount ? `<tr><td>Desconto</td><td class="num">-${formatBRL(budget.discount)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td class="num">${formatBRL(budget.total)}</td></tr>
    </table>
  </div>

  ${budget.conditions ? `<div class="conditions"><strong>Condições:</strong><br/>${escapeHtml(budget.conditions)}</div>` : ''}
  ${budget.notes ? `<div class="conditions"><strong>Observações:</strong><br/>${escapeHtml(budget.notes)}</div>` : ''}

  <div class="footer">Gerado por ${escapeHtml(store.name)} via PrecyFlow</div>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}
