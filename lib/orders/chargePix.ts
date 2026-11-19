/**
 * Pix da cobrança (Financeiro → Cobrança) — SEMPRE a chave CNPJ da
 * empresa, nunca a chave Pix genérica configurada em
 * Configurações › Dados de pagamento (essa é livre/qualquer tipo e
 * usada em orçamentos/pedidos; a cobrança do Financeiro é
 * especificamente ligada ao CNPJ da empresa, por pedido explícito do
 * fluxo de cobrança).
 *
 * Nunca inventa dado: se a empresa não tiver CNPJ e cidade cadastrados
 * em Configurações, a cobrança não pode ser gerada (ver
 * `missingCompanyPixFields`).
 */

import QRCode from 'qrcode'
import { onlyDigits, isValidCnpjLength } from '@/lib/utils/mask'
import { buildPixPayload, sanitizeTxid } from '@/lib/pix/brcode'

export interface CompanyForChargePix {
  name?: string | null
  cnpj?: string | null
  city?: string | null
}

/** Campos que faltam na empresa para poder gerar o Pix da cobrança (vazio = pode gerar). */
export function missingCompanyPixFields(company: CompanyForChargePix | null | undefined): string[] {
  const missing: string[] = []
  const cnpjDigits = onlyDigits(company?.cnpj)
  if (!company || !isValidCnpjLength(cnpjDigits)) missing.push('CNPJ')
  if (!company?.city) missing.push('Cidade')
  if (!company?.name) missing.push('Nome da empresa')
  return missing
}

export interface ChargePixSnapshot {
  pix_type: 'cnpj'
  pix_key: string
  pix_label: string
}

/** Snapshot gravado em order_charges no momento da criação (congela CNPJ/nome). */
export function buildChargePixSnapshot(company: CompanyForChargePix): ChargePixSnapshot {
  const missing = missingCompanyPixFields(company)
  if (missing.length > 0) {
    throw new Error(`Configure ${missing.join(', ')} da empresa em Configurações antes de gerar uma cobrança.`)
  }
  return {
    pix_type: 'cnpj',
    pix_key: onlyDigits(company.cnpj),
    pix_label: (company.name || '').trim(),
  }
}

export interface RenderedChargePix {
  key: string
  type: 'cnpj'
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
    type: 'cnpj',
    label: params.pixLabel,
    amount: params.amount,
    payload,
    qrCodeBase64,
  }
}
