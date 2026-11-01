/**
 * Cálculo do valor BRUTO a cobrar do cliente para que a loja receba
 * exatamente o valor líquido (preço cadastrado = preço no Pix) depois da
 * taxa do gateway — nunca "preço + taxa%", que sub-cobra o lojista.
 *
 *   bruto = (líquido + taxaFixa) / (1 - taxaPercentual)
 *
 * Tudo trabalha em CENTAVOS (inteiros) para nunca acumular erro de
 * arredondamento de ponto flutuante — só as funções de borda (toCents/
 * fromCents) tocam números decimais.
 */

export interface FeeRule {
  /** Taxa percentual como fração (ex.: 0.0499 = 4,99%). */
  feePercent: number
  /** Taxa fixa em reais (ex.: 0.39). */
  feeFixed: number
}

export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/** Valor bruto (em centavos) que, cobrado do cliente, preserva o líquido desejado. */
export function computeGrossCents(netCents: number, rule: FeeRule): number {
  if (rule.feePercent < 0 || rule.feePercent >= 1) {
    throw new Error(`Taxa percentual inválida: ${rule.feePercent} (deve estar entre 0 e 1, exclusive)`)
  }
  if (rule.feeFixed < 0) {
    throw new Error(`Taxa fixa inválida: ${rule.feeFixed}`)
  }
  const feeFixedCents = toCents(rule.feeFixed)
  const grossCents = (netCents + feeFixedCents) / (1 - rule.feePercent)
  return Math.round(grossCents)
}

/** Valor bruto (em reais) a partir de um valor líquido (em reais). */
export function computeGrossAmount(netAmount: number, rule: FeeRule): number {
  return fromCents(computeGrossCents(toCents(netAmount), rule))
}

/** Diferença entre bruto e líquido — é exatamente o que o gateway retém + o acréscimo repassado. */
export function computeFeeAmount(grossAmount: number, netAmount: number): number {
  return fromCents(toCents(grossAmount) - toCents(netAmount))
}

/**
 * Divide um valor bruto (em centavos) em N parcelas o mais iguais possível,
 * sem perder nem criar centavo nenhum (soma das parcelas === total). O
 * resto da divisão é distribuído uma unidade por vez nas primeiras
 * parcelas, convenção comum de parcelamento sem surpresa no total.
 */
export function splitInstallmentsCents(totalCents: number, installments: number): number[] {
  if (!Number.isInteger(installments) || installments < 1) {
    throw new Error(`Número de parcelas inválido: ${installments}`)
  }
  const base = Math.floor(totalCents / installments)
  const remainder = totalCents - base * installments
  return Array.from({ length: installments }, (_, i) => base + (i < remainder ? 1 : 0))
}

export interface InstallmentBreakdown {
  installments: number
  installmentAmount: number
  totalAmount: number
  feeAmount: number
}

/**
 * Monta o detalhamento completo de uma modalidade de parcelamento a partir
 * do valor líquido desejado e da regra de taxa daquele número de parcelas
 * — cada número de parcelas pode ter uma taxa diferente (ver
 * payment_fee_rules), nunca assume que a taxa de 1x vale para 2x/3x.
 */
export function buildInstallmentBreakdown(netAmount: number, installments: number, rule: FeeRule): InstallmentBreakdown {
  const netCents = toCents(netAmount)
  const grossCents = computeGrossCents(netCents, rule)
  const perInstallmentCents = splitInstallmentsCents(grossCents, installments)
  // Todas as parcelas somam exatamente o bruto, então a "parcela" exibida é
  // a maior delas (as demais, se houver resto, diferem em 1 centavo) — exibir
  // a primeira é consistente e nunca mostra um total diferente da soma real.
  return {
    installments,
    installmentAmount: fromCents(perInstallmentCents[0]),
    totalAmount: fromCents(grossCents),
    feeAmount: fromCents(grossCents - netCents),
  }
}
