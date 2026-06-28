/**
 * Precy+ — Módulo central de dimensões
 *
 * ÚNICA fonte de verdade para cálculo, conversão e formatação de medidas.
 * Todos os módulos (Precificação, Produtos, Orçamentos, PDF) importam daqui.
 *
 * Conversões internas (sempre em metros):
 *   mm → ÷ 1000   cm → ÷ 100   m → ÷ 1
 */

const FACTOR: Record<string, number> = { mm: 1000, cm: 100, m: 1 }

/** Converte um valor para metros conforme a unidade informada. */
export function toMeters(value: number, unit: string): number {
  return value / (FACTOR[unit] ?? 1)
}

/**
 * Calcula a área em m² a partir de largura, altura e unidade original.
 *
 * @example
 *   calculateAreaM2(100, 30, 'cm')  → 0.3
 *   calculateAreaM2(1000, 300, 'mm') → 0.3
 *   calculateAreaM2(1, 0.3, 'm')   → 0.3
 */
export function calculateAreaM2(width: number, height: number, unit: string): number {
  return toMeters(width, unit) * toMeters(height, unit)
}

// ── Formatação ──────────────────────────────────────────────────────────────

/** Valor original: inteiros sem casas, decimais com 2 casas. */
function fmtOrig(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(2).replace('.', ',')
}

/** Valor em metros: sempre 2 casas decimais (ex: 1,00 / 0,30). */
function fmtM(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

/**
 * Dimensões na unidade original.
 * @example formatDimDisplay(100, 30, 'cm') → "100 cm × 30 cm"
 */
export function formatDimDisplay(width: number, height: number, unit: string): string {
  return `${fmtOrig(width)} ${unit} × ${fmtOrig(height)} ${unit}`
}

/**
 * Dimensões convertidas para metros.
 * @example formatDimMeters(100, 30, 'cm') → "1,00 m × 0,30 m"
 */
export function formatDimMeters(width: number, height: number, unit: string): string {
  return `${fmtM(toMeters(width, unit))} m × ${fmtM(toMeters(height, unit))} m`
}

/**
 * Área em m² com 4 casas decimais.
 * @example formatAreaM2(0.3) → "0,3000"
 */
export function formatAreaM2(areaM2: number): string {
  return areaM2.toFixed(4).replace('.', ',')
}

/**
 * Bloco completo para exibição (original + metros + área).
 * Retorna objeto com as três linhas separadas para renderização flexível.
 */
export function getDimBlock(
  width: number,
  height: number,
  unit: string,
  storedArea?: number | null,
) {
  const wM = toMeters(width, unit)
  const hM = toMeters(height, unit)
  const area = storedArea && storedArea > 0
    ? storedArea
    : wM * hM

  return {
    original:  formatDimDisplay(width, height, unit),          // "100 cm × 30 cm"
    meters:    unit === 'm' ? null : formatDimMeters(width, height, unit), // "1,00 m × 0,30 m" (null se já em metros)
    area:      formatAreaM2(area),                             // "0,3000"
    areaValue: area,
  }
}

/**
 * String compacta para uso no PDF: "100 cm × 30 cm · Área: 0,3000 m²"
 */
export function formatDimCompact(
  width: number,
  height: number,
  unit: string,
  storedArea?: number | null,
): string {
  const { original, area } = getDimBlock(width, height, unit, storedArea)
  return `${original} · Área: ${area} m²`
}

// ── Validação ───────────────────────────────────────────────────────────────

/**
 * Retorna aviso quando o valor parece inconsistente com a unidade.
 * Não bloqueia — apenas informa.
 *
 * Exemplos de alertas:
 *   0,3 cm  → "0,3 cm equivale a 3 mm. Verifique a unidade."
 *   0,5 mm  → "0,5 mm é menor que 1 mm. Verifique a unidade."
 */
export function getDimWarning(
  width: number | undefined,
  height: number | undefined,
  unit: string,
): string | null {
  const vals = [width, height].filter((v): v is number => v !== undefined && v > 0)
  if (vals.length === 0) return null

  if (unit === 'cm') {
    const small = vals.filter(v => v < 1)
    if (small.length > 0) {
      const ex = small.map(v => `${fmtOrig(v)} cm = ${fmtOrig(v * 10)} mm`).join(', ')
      return `Valor muito pequeno para centímetros: ${ex}. Verifique a unidade ou use metros.`
    }
  }

  if (unit === 'mm') {
    const small = vals.filter(v => v < 1)
    if (small.length > 0) {
      const ex = small.map(v => `${fmtOrig(v)} mm`).join(', ')
      return `Valor menor que 1 mm: ${ex}. Verifique se a unidade está correta.`
    }
  }

  if (unit === 'm') {
    const big = vals.filter(v => v > 50)
    if (big.length > 0) {
      return `Dimensão muito grande: ${big.map(v => `${fmtOrig(v)} m`).join(', ')}. Verifique se a unidade está correta.`
    }
  }

  return null
}
