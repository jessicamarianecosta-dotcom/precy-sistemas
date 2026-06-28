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
 * Ex: 0.003 → "0,0030"   0.3 → "0,3000"
 */
export function formatAreaM2(areaM2: number): string {
  return areaM2.toFixed(4).replace('.', ',')
}

/**
 * Formata um valor numérico de dimensão: inteiros sem decimais, outros com 2 casas.
 * Ex: 100 → "100"   0.3 → "0,30"   1.5 → "1,50"
 */
function fmtVal(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(2).replace('.', ',')
}

/**
 * Formata as dimensões com unidade ao lado de cada medida.
 * Ex: formatDimDisplay(100, 30, 'cm') → "100 cm × 30 cm"
 *     formatDimDisplay(1, 0.3, 'm')  → "1 m × 0,30 m"
 */
export function formatDimDisplay(width: number, height: number, unit: string): string {
  return `${fmtVal(width)} ${unit} × ${fmtVal(height)} ${unit}`
}

/**
 * Retorna string de dimensão completa com área calculada para exibição.
 * Ex: "100 cm × 30 cm · Área: 0,3000 m²"
 */
export function formatDimWithArea(
  width: number,
  height: number,
  unit: string,
  storedArea?: number | null,
): string {
  const dim = formatDimDisplay(width, height, unit)
  const area = storedArea && storedArea > 0
    ? storedArea
    : calculateAreaM2(width, height, unit)
  return `${dim} · Área: ${formatAreaM2(area)} m²`
}
