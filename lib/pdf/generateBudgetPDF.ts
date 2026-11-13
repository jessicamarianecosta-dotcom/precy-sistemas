/* ============================================================
   PRECY+ — PDF Premium v4
   Visual: ERP / Gráfica Profissional / Proposta Comercial

   O HTML/CSS em si vive em budgetPrintTemplate.ts (compartilhado com o
   botão "Imprimir" do orçamento público) — este arquivo só resolve os
   dados do painel (budget/items/company do Supabase) para o formato
   que o template espera.
   ============================================================ */

import { getBudgetItems } from '@/lib/pdf/getBudgetItems'
import { companyPickupAddressLines } from '@/lib/company/pickupAddress'
import { buildPixPayload, sanitizeTxid } from '@/lib/pix/brcode'
import QRCode from 'qrcode'
import type { OrderFile } from '@/components/orders/types'
import { renderBudgetPrintHTML, openBudgetPrintWindow, type BudgetPrintVM } from '@/lib/pdf/budgetPrintTemplate'

interface PDFParams {
  budget:  Record<string, unknown>
  items:   Record<string, unknown>[]
  company: Record<string, unknown> | null
  /** Sobrescreve o <title> do documento (usado como nome sugerido no "Salvar como PDF"). */
  fileName?: string
  /** Arte(s) anexada(s) ao pedido de origem — exibidas inteiras, sem corte. */
  artFiles?: OrderFile[]
}

export async function generateBudgetPDF({ budget, items, company, fileName, artFiles }: PDFParams) {
  const co   = company as any ?? {}
  const b    = budget  as any ?? {}
  const cust = b.customers as any ?? {}

  /* ── QR Code Pix (BR Code/EMV) — mesmo payload exibido no orçamento público ── */
  let bPixQrCode = ''
  if (b.pix_key) {
    try {
      const pixAmount = b.pay_condition === 'entrada' && (Number(b.signal_amount) || 0) > 0
        ? Number(b.signal_amount)
        : (Number(b.total) || 0)
      const txid = b.pix_txid || sanitizeTxid(b.budget_number || b.id || '')
      const payload = buildPixPayload({
        pixKey: String(b.pix_key),
        merchantName: String(co.name ?? 'RECEBEDOR'),
        merchantCity: String(co.city ?? 'BRASIL'),
        amount: pixAmount,
        txid,
      })
      bPixQrCode = await QRCode.toDataURL(payload, { margin: 1, width: 240 })
    } catch (err) {
      console.error('[generateBudgetPDF] erro ao gerar QR Code Pix', err)
    }
  }

  /* ── Itens — fonte única via getBudgetItems ── */
  const effectiveItems = getBudgetItems(budget, items)

  /* ── Arte enviada pelo cliente ── */
  const artFileVMs = (artFiles ?? [])
    .filter(f => f?.file_url)
    .map(f => ({ file_name: f.file_name, file_url: f.file_url }))

  const vm: BudgetPrintVM = {
    company: {
      name: co.name,
      email: co.email,
      phone: co.phone,
      cnpj: co.cnpj,
      address: co.address,
      instagram: co.instagram,
      website: co.website,
      logoUrl: co.logo_url ?? null,
      primaryColor: co.primary_color,
      pickupLines: companyPickupAddressLines(co),
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
      signalAmount: Number(b.signal_amount) || Number(b.signal_amt) || 0,
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
      additionalCharges: b.additional_charges,
      total: b.total,
      pixKey: b.pix_key,
      pixType: b.pix_type,
      pixLabel: b.pix_label,
      pixQrCodeDataUrl: bPixQrCode,
    },
    customer: {
      name: cust.name,
      phone: cust.phone,
      email: cust.email,
      cpfCnpj: cust.cpf_cnpj,
      city: cust.city,
      state: cust.state,
      address: cust.address,
    },
    items: effectiveItems as any,
    artFiles: artFileVMs,
    fileName,
  }

  const html = renderBudgetPrintHTML(vm)
  openBudgetPrintWindow(html)
}
