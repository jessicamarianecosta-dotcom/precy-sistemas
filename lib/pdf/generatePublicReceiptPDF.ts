/* ============================================================
   PRECY+ — Botão "Baixar PDF" do recibo público

   A partir dos dados já carregados por GET /api/loja/recibo/[token].
   ============================================================ */

import { renderReceiptPrintHTML, openReceiptPrintWindow, type ReceiptPrintVM } from '@/lib/pdf/receiptPrintTemplate'

export interface PublicReceiptPrintData {
  receipt: Record<string, unknown>
  order: Record<string, unknown>
  customer: Record<string, unknown>
  company: Record<string, unknown>
}

export function generatePublicReceiptPDF(data: PublicReceiptPrintData): void {
  const r = data.receipt as any
  const o = data.order as any
  const cu = data.customer as any
  const co = data.company as any

  const vm: ReceiptPrintVM = {
    company: {
      name: co.name,
      email: co.email,
      phone: co.phone,
      cnpj: co.cnpj,
      logoUrl: co.logo_url ?? null,
      primaryColor: co.primary_color,
    },
    order: {
      number: o.order_number,
      serviceName: o.service_name,
      balanceAfter: Number(o.balance_after) || 0,
      items: Array.isArray(o.items) ? o.items.map((i: any) => ({
        name: String(i.name ?? ''),
        description: String(i.description ?? ''),
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.unit_price) || 0,
        subtotal: Number(i.subtotal) || 0,
      })) : [],
    },
    customer: {
      name: cu.name,
      cpfCnpj: cu.cpf_cnpj,
    },
    receipt: {
      amount: Number(r.amount) || 0,
      paymentDate: r.payment_date,
      paymentMethodLabel: r.payment_method_label,
      observation: r.observation,
    },
  }

  const html = renderReceiptPrintHTML(vm)
  openReceiptPrintWindow(html)
}
