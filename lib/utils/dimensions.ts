/**
 * Calcula a área em m² a partir de largura, altura e unidade original.
 * Conversões: mm → /1000, cm → /100, m → /1 (identidade)
 */
export function calculateAreaM2(width: number, height: number, unit: string): number {
  const factor: Record<string, number> = { mm: 1000, cm: 100, m: 1 }
  const d = factor[unit] ?? 1
  return (width / d) * (height / d)
}

/**
 * Formata área em m² com 4 casas decimais usando vírgula.
 * Remove zeros à direita desnecessários para exibição limpa.
 * Ex: 0.003 → "0,0030"   30 → "30,0000"
 */
export function formatAreaM2(areaM2: number): string {
  // Mantém 4 casas decimais mas remove zeros à direita após a 2ª casa
  const s = areaM2.toFixed(4).replace('.', ',')
  return s
}
