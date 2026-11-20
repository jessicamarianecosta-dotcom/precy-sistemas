/**
 * PRECY MONTAGEM — motor de cálculo geométrico de aproveitamento.
 *
 * Toda a matemática é exata (mm, divisão inteira via Math.floor) — nunca
 * "aproximada": uma quantidade informada aqui é sempre fisicamente possível
 * com as margens e espaçamentos dados. Tolerância de ponto flutuante de
 * 1e-6 mm evita que um valor como 29.7 - 2 - 2 "quase 25.7" vire 25.699999
 * e derrube uma coluna que deveria caber.
 */

import type { BobinaConfig, FolhaConfig, MarginsMm, PackingComparison, PackingResult, SheetPreset, SpacingMm } from './types'

const EPS = 1e-6

export const SHEET_PRESETS: Record<Exclude<SheetPreset, 'custom'>, { widthMm: number; heightMm: number; label: string }> = {
  A4: { widthMm: 210, heightMm: 297, label: 'A4 (21 × 29,7 cm)' },
  A3: { widthMm: 297, heightMm: 420, label: 'A3 (29,7 × 42 cm)' },
  A5: { widthMm: 148, heightMm: 210, label: 'A5 (14,8 × 21 cm)' },
}

/** Quantas unidades de `item` (+ espaçamento `gap` entre elas) cabem em `usable`. */
export function fitCount(usableMm: number, itemMm: number, gapMm: number): number {
  if (itemMm <= 0) return 0
  if (usableMm < itemMm - EPS) return 0
  return Math.floor((usableMm + gapMm + EPS) / (itemMm + gapMm))
}

/** Espaço fisicamente ocupado por `n` itens de tamanho `itemMm` com espaçamento `gapMm` entre eles. */
export function spaceForCount(n: number, itemMm: number, gapMm: number): number {
  if (n <= 0) return 0
  return n * itemMm + (n - 1) * gapMm
}

function emptyResult(containerW: number, containerH: number, reason: string): PackingResult {
  return {
    cols: 0, rows: 0, total: 0, rotated: false,
    itemWidthMm: 0, itemHeightMm: 0,
    usableWidthMm: 0, usableHeightMm: 0,
    containerWidthMm: containerW, containerHeightMm: containerH,
    usedAreaMm2: 0, totalAreaMm2: containerW * containerH,
    wasteAreaMm2: containerW * containerH,
    utilizationPct: 0, fits: false, reason, manual: false,
  }
}

interface SheetPackingInput {
  sheetWidthMm: number
  sheetHeightMm: number
  itemWidthMm: number
  itemHeightMm: number
  margins: MarginsMm
  spacing: SpacingMm
  rotate: boolean
}

export function computeSheetPacking(input: SheetPackingInput): PackingResult {
  const { sheetWidthMm, sheetHeightMm, margins, spacing, rotate } = input
  const iw = rotate ? input.itemHeightMm : input.itemWidthMm
  const ih = rotate ? input.itemWidthMm : input.itemHeightMm

  const usableW = sheetWidthMm - margins.left - margins.right
  const usableH = sheetHeightMm - margins.top - margins.bottom

  if (usableW <= 0 || usableH <= 0) {
    return { ...emptyResult(sheetWidthMm, sheetHeightMm, 'As margens informadas não deixam área útil na folha.'), rotated: rotate }
  }

  const cols = fitCount(usableW, iw, spacing.x)
  const rows = fitCount(usableH, ih, spacing.y)
  const total = cols * rows

  if (total === 0) {
    return {
      ...emptyResult(sheetWidthMm, sheetHeightMm, 'O produto não cabe na folha com essas margens e espaçamentos.'),
      rotated: rotate, itemWidthMm: iw, itemHeightMm: ih, usableWidthMm: usableW, usableHeightMm: usableH,
    }
  }

  const usedArea = total * iw * ih
  const totalArea = sheetWidthMm * sheetHeightMm

  return {
    cols, rows, total, rotated: rotate,
    itemWidthMm: iw, itemHeightMm: ih,
    usableWidthMm: usableW, usableHeightMm: usableH,
    containerWidthMm: sheetWidthMm, containerHeightMm: sheetHeightMm,
    usedAreaMm2: usedArea, totalAreaMm2: totalArea,
    wasteAreaMm2: totalArea - usedArea,
    utilizationPct: (usedArea / totalArea) * 100,
    fits: true, manual: false,
  }
}

export function bestSheetPacking(input: Omit<SheetPackingInput, 'rotate'>): PackingComparison {
  const normal = computeSheetPacking({ ...input, rotate: false })
  const rotated = computeSheetPacking({ ...input, rotate: true })
  const best = rotated.total > normal.total ? rotated : normal
  return { best, normal, rotated }
}

/**
 * Resultado de uma montagem em folha a partir de um FolhaConfig completo
 * (com override manual).
 *
 * `comparison.normal` — calculado com as dimensões ATUAIS da arte — é
 * sempre o layout realmente usado (o que de fato é ladrilhado e exportado).
 * `comparison.rotated` é só informativo: "se você girar a arte 90°, caberia
 * mais". A UI oferece girar a arte de verdade (ação que gira o bitmap,
 * ver `rotateArt`/`setRotation`) em vez de só trocar a conta sem girar a
 * imagem — do contrário a arte sairia esticada/distorcida ao ladrilhar.
 */
export function packFolha(config: FolhaConfig, itemWidthMm: number, itemHeightMm: number): PackingComparison {
  const base = { sheetWidthMm: config.sheetWidthMm, sheetHeightMm: config.sheetHeightMm, itemWidthMm, itemHeightMm, margins: config.margins, spacing: config.spacing }
  const comparison = bestSheetPacking(base)

  if (config.manualCols == null && config.manualRows == null) return { ...comparison, best: comparison.normal }

  const manual = applyManualOverride(comparison.normal, config.manualCols, config.manualRows, config.spacing, comparison.normal.usableWidthMm, comparison.normal.usableHeightMm)
  return { ...comparison, best: manual }
}

interface RollPackingInput {
  rollWidthMm: number
  itemWidthMm: number
  itemHeightMm: number
  margins: MarginsMm
  spacing: SpacingMm
  rotate: boolean
  rollLengthMm: number | null
  desiredQty: number | null
}

export function computeRollPacking(input: RollPackingInput): PackingResult {
  const { rollWidthMm, margins, spacing, rotate, rollLengthMm, desiredQty } = input
  const iw = rotate ? input.itemHeightMm : input.itemWidthMm
  const ih = rotate ? input.itemWidthMm : input.itemHeightMm

  const usableW = rollWidthMm - margins.left - margins.right
  if (usableW <= 0) {
    return { ...emptyResult(rollWidthMm, rollLengthMm ?? 0, 'As margens laterais não deixam área útil na bobina.'), rotated: rotate }
  }

  const cols = fitCount(usableW, iw, spacing.x)
  if (cols === 0) {
    return {
      ...emptyResult(rollWidthMm, rollLengthMm ?? 0, 'O produto é mais largo que a área útil da bobina.'),
      rotated: rotate, itemWidthMm: iw, itemHeightMm: ih, usableWidthMm: usableW,
    }
  }

  if (desiredQty && desiredQty > 0) {
    const rows = Math.ceil(desiredQty / cols)
    const usableLenNeeded = spaceForCount(rows, ih, spacing.y)
    const lengthNeeded = usableLenNeeded + margins.top + margins.bottom
    const total = cols * rows
    const usedArea = total * iw * ih
    const totalArea = rollWidthMm * lengthNeeded

    return {
      cols, rows, total, rotated: rotate,
      itemWidthMm: iw, itemHeightMm: ih,
      usableWidthMm: usableW, usableHeightMm: usableLenNeeded,
      containerWidthMm: rollWidthMm, containerHeightMm: lengthNeeded,
      usedAreaMm2: usedArea, totalAreaMm2: totalArea,
      wasteAreaMm2: totalArea - usedArea,
      utilizationPct: (usedArea / totalArea) * 100,
      lengthNeededMm: lengthNeeded, fits: true, manual: false,
    }
  }

  const length = rollLengthMm ?? 0
  const usableH = length - margins.top - margins.bottom
  if (usableH <= 0) {
    return { ...emptyResult(rollWidthMm, length, 'Informe o comprimento da bobina ou a quantidade desejada.'), rotated: rotate, itemWidthMm: iw, itemHeightMm: ih, usableWidthMm: usableW }
  }

  const rows = fitCount(usableH, ih, spacing.y)
  const total = cols * rows
  if (total === 0) {
    return {
      ...emptyResult(rollWidthMm, length, 'O produto não cabe no comprimento informado com essas margens e espaçamentos.'),
      rotated: rotate, itemWidthMm: iw, itemHeightMm: ih, usableWidthMm: usableW, usableHeightMm: usableH,
    }
  }

  const usedArea = total * iw * ih
  const totalArea = rollWidthMm * length

  return {
    cols, rows, total, rotated: rotate,
    itemWidthMm: iw, itemHeightMm: ih,
    usableWidthMm: usableW, usableHeightMm: usableH,
    containerWidthMm: rollWidthMm, containerHeightMm: length,
    usedAreaMm2: usedArea, totalAreaMm2: totalArea,
    wasteAreaMm2: totalArea - usedArea,
    utilizationPct: (usedArea / totalArea) * 100,
    fits: true, manual: false,
  }
}

export function bestRollPacking(input: Omit<RollPackingInput, 'rotate'>): PackingComparison {
  const normal = computeRollPacking({ ...input, rotate: false })
  const rotated = computeRollPacking({ ...input, rotate: true })
  const best = rotated.total > normal.total ? rotated : normal
  return { best, normal, rotated }
}

export function packBobina(config: BobinaConfig, itemWidthMm: number, itemHeightMm: number): PackingComparison {
  const base = {
    rollWidthMm: config.rollWidthMm, itemWidthMm, itemHeightMm,
    margins: config.margins, spacing: config.spacing,
    rollLengthMm: config.rollLengthMm, desiredQty: config.desiredQty,
  }
  const comparison = bestRollPacking(base)

  if (config.manualCols == null && config.manualRows == null) return { ...comparison, best: comparison.normal }

  const manual = applyManualOverride(comparison.normal, config.manualCols, config.manualRows, config.spacing, comparison.normal.usableWidthMm, comparison.normal.usableHeightMm, config.rollWidthMm)
  return { ...comparison, best: manual }
}

/**
 * Sobrescreve cols/rows manualmente. Nunca aceita silenciosamente um valor
 * que não caiba fisicamente — marca `fits: false` com o motivo exato, para a
 * UI bloquear a exportação em vez de gerar uma montagem inválida.
 */
function applyManualOverride(
  auto: PackingResult,
  manualCols: number | null,
  manualRows: number | null,
  spacing: SpacingMm,
  usableWidthMm: number,
  usableHeightMm: number,
  containerWidthOverride?: number,
): PackingResult {
  const cols = manualCols ?? auto.cols
  const rows = manualRows ?? auto.rows
  const total = cols * rows

  const neededW = spaceForCount(cols, auto.itemWidthMm, spacing.x)
  const neededH = spaceForCount(rows, auto.itemHeightMm, spacing.y)

  const fitsW = neededW <= usableWidthMm + EPS
  const fitsH = auto.lengthNeededMm != null ? true : neededH <= usableHeightMm + EPS

  if (cols <= 0 || rows <= 0 || !fitsW || !fitsH) {
    return {
      ...auto,
      cols, rows, total,
      fits: false, manual: true,
      reason: !fitsW
        ? `${cols} colunas não cabem na largura útil (${usableWidthMm.toFixed(1)} mm).`
        : `${rows} linhas não cabem na altura/comprimento útil (${usableHeightMm.toFixed(1)} mm).`,
    }
  }

  const usedArea = total * auto.itemWidthMm * auto.itemHeightMm
  let totalArea = auto.totalAreaMm2
  let lengthNeededMm = auto.lengthNeededMm
  let containerHeightMm = auto.containerHeightMm

  // Bobina com quantidade manual: o comprimento necessário muda com as linhas escolhidas.
  if (auto.lengthNeededMm != null && containerWidthOverride != null) {
    const usableLen = spaceForCount(rows, auto.itemHeightMm, spacing.y)
    lengthNeededMm = usableLen + (auto.containerHeightMm - auto.usableHeightMm)
    containerHeightMm = lengthNeededMm
    totalArea = containerWidthOverride * lengthNeededMm
  }

  return {
    ...auto,
    cols, rows, total,
    containerHeightMm,
    usedAreaMm2: usedArea,
    totalAreaMm2: totalArea,
    wasteAreaMm2: totalArea - usedArea,
    utilizationPct: totalArea > 0 ? (usedArea / totalArea) * 100 : 0,
    lengthNeededMm,
    fits: true, manual: true, reason: undefined,
  }
}
