/**
 * Formatação monetária única do Precy+ Sistemas.
 *
 * REGRA GLOBAL: sempre exibir exatamente 2 casas decimais.
 *   ✅ R$ 230,84
 *   ❌ R$ 230,836
 *
 * O banco continua salvando a precisão completa (ex: 230.836451).
 * Esta função afeta SOMENTE a exibição — nenhum cálculo é alterado.
 *
 * Uso:
 *   import { formatCurrency } from '@/lib/utils/format'
 *   formatCurrency(230.836451) // "R$ 230,84"
 */
export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value ?? 0)
  const safe = Number.isFinite(num) ? num : 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)
}

/**
 * Formatação de porcentagem padrão do sistema (1 casa decimal).
 * Ex: formatPercent(33.333) -> "33,3%"
 */
export function formatPercent(value: number | string | null | undefined): string {
  const num = Number(value ?? 0)
  const safe = Number.isFinite(num) ? num : 0
  return `${safe.toFixed(1)}%`
}
