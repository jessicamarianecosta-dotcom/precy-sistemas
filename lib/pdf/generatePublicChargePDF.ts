/* ============================================================
   PRECY+ — Botão "Baixar PDF" da cobrança pública

   A partir dos dados já carregados por GET /api/loja/cobranca/[token]
   (sem acesso ao Supabase — a página pública não tem sessão do lojista).
   ============================================================ */

import { renderChargePrintHTML, openChargePrintWindow, type ChargePrintVM } from '@/lib/pdf/chargePrintTemplate'

export interface PublicChargePrintData {
  charge: Record<string, unknown>
  order: Record<string, unknown>
  customer: Record<string, unknown>
  company: Record<string, unknown>
  pix: { key: string; label: string; payload: string; qrCodeBase64: string } | null
}

export function generatePublicChargePDF(data: PublicChargePrintData): void {
  const c = data.charge as any
  const o = data.order as any
  const cu = data.customer as any
  const co = data.company as any

  const vm: ChargePrintVM = {
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
    },
    customer: {
      name: cu.name,
    },
    charge: {
      amountDue: Number(c.amount_due) || 0,
      dueDate: c.due_date,
      status: c.status,
      notes: c.notes,
      createdAt: c.created_at,
    },
    pix: data.pix,
  }

  const html = renderChargePrintHTML(vm)
  openChargePrintWindow(html)
}
