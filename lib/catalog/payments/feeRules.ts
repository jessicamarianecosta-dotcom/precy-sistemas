import { supabaseAdmin } from '@/lib/supabase/admin'
import type { FeeRule } from './feeCalculator'

export type PaymentMethodKind = 'pix' | 'credit_card'

/**
 * Busca a regra de taxa efetiva para (loja, método, parcelas): prioriza uma
 * regra específica da loja (company_id preenchido) e cai para a regra
 * global da plataforma (company_id NULL) — nunca inventa um número se
 * nenhuma das duas existir, estoura erro explícito em vez de cobrar
 * silenciosamente um valor errado.
 */
export async function getFeeRule(
  companyId: string,
  method: PaymentMethodKind,
  installments: number,
  provider = 'mercadopago',
): Promise<FeeRule> {
  const { data, error } = await (supabaseAdmin.from('payment_fee_rules') as any)
    .select('fee_percent, fee_fixed, company_id')
    .eq('provider', provider)
    .eq('payment_method', method)
    .eq('installments', installments)
    .or(`company_id.eq.${companyId},company_id.is.null`)

  if (error) throw new Error(`Erro ao consultar taxas: ${error.message}`)

  const rows: Array<{ fee_percent: number; fee_fixed: number; company_id: string | null }> = data ?? []
  const specific = rows.find(r => r.company_id === companyId)
  const global = rows.find(r => r.company_id === null)
  const chosen = specific ?? global

  if (!chosen) {
    throw new Error(
      `Nenhuma taxa configurada para ${provider}/${method}/${installments}x. ` +
      `Cadastre em payment_fee_rules antes de habilitar essa modalidade de pagamento.`
    )
  }

  return { feePercent: Number(chosen.fee_percent), feeFixed: Number(chosen.fee_fixed) }
}

/** Todas as regras visíveis (globais + da loja) — usado para exibir "taxas configuradas" nas Configurações. */
export async function listFeeRules(companyId: string, provider = 'mercadopago') {
  const { data, error } = await (supabaseAdmin.from('payment_fee_rules') as any)
    .select('payment_method, installments, fee_percent, fee_fixed, company_id, notes, updated_at')
    .eq('provider', provider)
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('payment_method', { ascending: true })
    .order('installments', { ascending: true })

  if (error) throw new Error(`Erro ao consultar taxas: ${error.message}`)

  // Para cada (método, parcelas) só a regra mais específica é relevante.
  const byKey = new Map<string, any>()
  for (const row of data ?? []) {
    const key = `${row.payment_method}:${row.installments}`
    const current = byKey.get(key)
    if (!current || (current.company_id === null && row.company_id !== null)) {
      byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}
