/* ============================================================
   PRECY+ — Botão "Imprimir" do orçamento público

   Usa o mesmo template de impressão do "Baixar PDF" do painel
   (budgetPrintTemplate.ts), mas a partir dos dados já carregados pela
   rota pública /api/loja/orcamento/[token] — sem acesso ao Supabase
   (a página pública não tem sessão/credenciais do lojista).
   ============================================================ */

import { formatBudgetTitle } from '@/lib/pdf/budgetTitle'
import { renderBudgetPrintHTML, openBudgetPrintWindow, type BudgetPrintVM } from '@/lib/pdf/budgetPrintTemplate'

/** Mesmo formato de dados retornado por GET /api/loja/orcamento/[token]. */
export interface PublicBudgetPrintData {
  budget: Record<string, unknown>
  company: Record<string, unknown>
  items: Record<string, unknown>[]
  art_files: { file_name: string; file_url: string }[]
  pix: { key: string; type: string | null; label: string | null; qrCodeBase64: string } | null
}

export function generatePublicBudgetPDF(data: PublicBudgetPrintData): void {
  const b   = data.budget as any
  const co  = data.company as any
  const pix = data.pix

  const vm: BudgetPrintVM = {
    company: {
      name: co.name,
      email: co.email,
      phone: co.phone,
      cnpj: co.cnpj,
      logoUrl: co.logo_url ?? null,
      primaryColor: co.primary_color,
      pickupLines: co.pickup_address_lines ?? [],
    },
    budget: {
      number: b.budget_number,
      createdAt: b.created_at,
      validUntil: b.valid_until,
      notes: b.notes,
      status: b.status,
      paymentMethod: b.payment_method,
      payCondition: b.pay_condition,
      installments: b.installments,
      signalAmount: b.signal_amount,
      deliveryType: b.delivery_type,
      deliveryFee: b.delivery_fee,
      deliveryAddr: b.delivery_addr,
      deliveryDays: b.delivery_days,
      productionDays: b.production_days,
      prazoType: b.prazo_type,
      prazoDias: b.prazo_dias,
      prazoDueDate: b.prazo_due_date,
      subtotal: b.subtotal,
      discount: b.discount,
      total: b.total,
      pixKey: pix?.key,
      pixType: pix?.type,
      pixLabel: pix?.label,
      pixQrCodeDataUrl: pix?.qrCodeBase64,
    },
    customer: {
      name: b.customer_name,
      phone: b.customer_phone,
      email: b.customer_email,
      cpfCnpj: b.customer_cpf_cnpj,
      city: b.customer_city,
      state: b.customer_state,
      address: b.customer_address,
    },
    items: data.items as any,
    artFiles: data.art_files ?? [],
    fileName: publicBudgetFileName(b),
  }

  const html = renderBudgetPrintHTML(vm)
  openBudgetPrintWindow(html)
}

/** Mesmo padrão de nome usado no "Salvar como PDF" do painel: "Orçamento #1100 — Cliente". */
function publicBudgetFileName(b: Record<string, unknown>): string {
  const o = b as any
  return formatBudgetTitle(o.budget_number, o.customer_name)
}
