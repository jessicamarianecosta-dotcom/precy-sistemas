/**
 * Pix da cobrança (Financeiro → Cobrança) — usa a MESMA chave Pix
 * configurada em Configurações › Dados de pagamento, já usada em
 * orçamentos e pedidos (mesmo padrão de app/api/loja/orcamento/[token]).
 *
 * Importante: não existe garantia de que toda empresa tenha um CNPJ
 * válido cadastrado (negócios informais/MEI podem não ter, ou podem
 * usar o campo "CNPJ" do cadastro da empresa para outra coisa, como
 * um @ do Instagram). A chave Pix é o dado que a própria usuária
 * escolheu e validou ao configurar "Dados de pagamento" — é essa que
 * deve ser usada para gerar a cobrança, não o campo CNPJ bruto.
 *
 * Nunca inventa dado: se a empresa não tiver uma chave Pix configurada
 * em Dados de pagamento, a cobrança não pode ser gerada (ver
 * `missingCompanyPixFields`).
 */

import QRCode from 'qrcode'
import { buildPixPayload, sanitizeTxid } from '@/lib/pix/brcode'

export interface CompanyForChargePix {
  name?: string | null
  pix_type?: string | null
  pix_key?: string | null
  pix_label?: string | null
  city?: string | null
}

/** Campos que faltam na empresa para poder gerar o Pix da cobrança (vazio = pode gerar). */
export function missingCompanyPixFields(company: CompanyForChargePix | null | undefined): string[] {
  const missing: string[] = []
  if (!company || !company.pix_key || !company.pix_key.trim()) missing.push('Chave Pix (Dados de pagamento)')
  return missing
}

export interface ChargePixSnapshot {
  pix_type: string
  pix_key: string
  pix_label: string
}

/** Snapshot gravado em order_charges no momento da criação (congela a chave/nome do momento). */
export function buildChargePixSnapshot(company: CompanyForChargePix): ChargePixSnapshot {
  const missing = missingCompanyPixFields(company)
  if (missing.length > 0) {
    throw new Error(`Configure ${missing.join(', ')} em Configurações antes de gerar uma cobrança.`)
  }
  return {
    pix_type: company.pix_type || 'outro',
    pix_key: (company.pix_key || '').trim(),
    pix_label: (company.pix_label || company.name || '').trim(),
  }
}

export interface RenderedChargePix {
  key: string
  type: string
  label: string
  amount: number
  payload: string
  qrCodeBase64: string
}

/**
 * Monta o BR Code + QR Code da cobrança para um valor específico (o
 * saldo em aberto no momento da consulta, nunca um valor congelado).
 * `merchantCity` vem do snapshot gravado em order_charges, não da
 * empresa atual — mesma regra de "documento emitido não muda sozinho".
 */
export async function renderChargePix(params: {
  pixKey: string
  pixType?: string
  pixLabel: string
  merchantCity: string
  amount: number
  txid: string
}): Promise<RenderedChargePix> {
  const txid = sanitizeTxid(params.txid)
  const payload = buildPixPayload({
    pixKey: params.pixKey,
    merchantName: params.pixLabel || 'RECEBEDOR',
    merchantCity: params.merchantCity || 'BRASIL',
    amount: params.amount,
    txid,
  })
  const qrCodeBase64 = await QRCode.toDataURL(payload, { margin: 1, width: 320 })
  return {
    key: params.pixKey,
    type: params.pixType || 'outro',
    label: params.pixLabel,
    amount: params.amount,
    payload,
    qrCodeBase64,
  }
}
