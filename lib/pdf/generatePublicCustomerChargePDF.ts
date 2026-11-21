/* ============================================================
   PRECY+ — Botão "Baixar PDF" da cobrança pública AGREGADA por cliente

   A partir dos dados já carregados por GET /api/loja/cobranca-cliente/[token]
   (sem acesso ao Supabase — a página pública não tem sessão do lojista).
   Mesmo padrão de generatePublicChargePDF.ts (cobrança de um único pedido).
   ============================================================ */

import {
  renderCustomerChargePrintHTML, openCustomerChargePrintWindow,
  type CustomerChargePrintVM, type CustomerChargeOrderRow,
} from '@/lib/pdf/customerChargePrintTemplate'

export interface PublicCustomerChargePrintData {
  charge: Record<string, unknown>
  orders: Array<Record<string, unknown>>
  customer: Record<string, unknown>
  company: Record<string, unknown>
  pix: { key: string; type?: string; label: string; payload: string; qrCodeBase64: string } | null
}

export function generatePublicCustomerChargePDF(data: PublicCustomerChargePrintData): void {
  const c = data.charge as any
  const cu = data.customer as any
  const co = data.company as any

  const orders: CustomerChargeOrderRow[] = (data.orders ?? []).map((o: any) => ({
    orderNumber: o.order_number ?? null,
    serviceName: o.service_name ?? null,
    total: Number(o.total) || 0,
    balance: Number(o.balance) || 0,
    settled: !!o.settled,
  }))

  const vm: CustomerChargePrintVM = {
    company: {
      name: co.name,
      email: co.email,
      phone: co.phone,
      cnpj: co.cnpj,
      logoUrl: co.logo_url ?? null,
      primaryColor: co.primary_color,
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
    orders,
    pix: data.pix,
  }

  const html = renderCustomerChargePrintHTML(vm)
  openCustomerChargePrintWindow(html)
}
