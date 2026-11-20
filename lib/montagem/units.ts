/**
 * PRECY MONTAGEM — conversões de unidade.
 *
 * Tudo internamente em milímetros (mm): precisão suficiente para artes de
 * pequeno formato (adesivos, cartões) sem os erros de arredondamento que
 * metros/polegadas em ponto flutuante trariam.
 */

export type Unit = 'mm' | 'cm' | 'm'

const TO_MM: Record<Unit, number> = { mm: 1, cm: 10, m: 1000 }

export function toMm(value: number, unit: Unit): number {
  return value * TO_MM[unit]
}

export function fromMm(valueMm: number, unit: Unit): number {
  return valueMm / TO_MM[unit]
}

/** 1 ponto PDF = 1/72 polegada = 25.4/72 mm. */
export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72
}

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

export function formatMm(valueMm: number, unit: Unit): string {
  const v = fromMm(valueMm, unit)
  const decimals = unit === 'mm' ? 1 : unit === 'cm' ? 2 : 4
  return `${trimZeros(v, decimals)} ${unit}`
}

function trimZeros(v: number, decimals: number): string {
  return v
    .toFixed(decimals)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',')
}

export function formatArea(areaMm2: number): string {
  const m2 = areaMm2 / 1_000_000
  return `${m2.toFixed(4).replace('.', ',')} m²`
}

export function formatPercent(pct: number): string {
  return `${pct.toFixed(1).replace('.', ',')}%`
}
