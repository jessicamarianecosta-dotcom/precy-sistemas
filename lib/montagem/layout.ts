/**
 * PRECY MONTAGEM — gera as posições (x, y) de cada cópia na grade a partir
 * de um PackingResult, já centralizada dentro da área útil do container.
 */

import type { CutContour, PackingResult, Point } from './types'

export interface TilePosition {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export function computeTilePositions(
  result: PackingResult,
  marginLeftMm: number,
  marginTopMm: number,
  spacingXMm: number,
  spacingYMm: number,
): TilePosition[] {
  const tiles: TilePosition[] = []
  if (!result.fits) return tiles

  const gridWidth = result.cols * result.itemWidthMm + (result.cols - 1) * spacingXMm
  const gridHeight = result.rows * result.itemHeightMm + (result.rows - 1) * spacingYMm
  // Centraliza a grade dentro da área útil (sobra de folga distribuída
  // igualmente nas bordas), em vez de empurrar tudo para o canto superior
  // esquerdo — resultado mais limpo e profissional para impressão.
  const offsetX = marginLeftMm + Math.max(0, (result.usableWidthMm - gridWidth) / 2)
  const offsetY = marginTopMm + Math.max(0, (result.usableHeightMm - gridHeight) / 2)

  for (let r = 0; r < result.rows; r++) {
    for (let c = 0; c < result.cols; c++) {
      tiles.push({
        xMm: offsetX + c * (result.itemWidthMm + spacingXMm),
        yMm: offsetY + r * (result.itemHeightMm + spacingYMm),
        widthMm: result.itemWidthMm,
        heightMm: result.itemHeightMm,
      })
    }
  }
  return tiles
}

export interface CropMarkLine {
  x1Mm: number; y1Mm: number; x2Mm: number; y2Mm: number
}

/** Uma marca de corte em "L" nos 4 cantos de cada tile, sem invadir a área útil do produto. */
export function computeCropMarks(tiles: TilePosition[], markLengthMm: number, offsetMm: number): CropMarkLine[] {
  const lines: CropMarkLine[] = []
  for (const t of tiles) {
    const corners: Array<[number, number, number, number]> = [
      [t.xMm - offsetMm, t.yMm, t.xMm - offsetMm - markLengthMm, t.yMm], // topo-esquerda, horizontal
      [t.xMm, t.yMm - offsetMm, t.xMm, t.yMm - offsetMm - markLengthMm], // topo-esquerda, vertical
      [t.xMm + t.widthMm + offsetMm, t.yMm, t.xMm + t.widthMm + offsetMm + markLengthMm, t.yMm],
      [t.xMm + t.widthMm, t.yMm - offsetMm, t.xMm + t.widthMm, t.yMm - offsetMm - markLengthMm],
      [t.xMm - offsetMm, t.yMm + t.heightMm, t.xMm - offsetMm - markLengthMm, t.yMm + t.heightMm],
      [t.xMm, t.yMm + t.heightMm + offsetMm, t.xMm, t.yMm + t.heightMm + offsetMm + markLengthMm],
      [t.xMm + t.widthMm + offsetMm, t.yMm + t.heightMm, t.xMm + t.widthMm + offsetMm + markLengthMm, t.yMm + t.heightMm],
      [t.xMm + t.widthMm, t.yMm + t.heightMm + offsetMm, t.xMm + t.widthMm, t.yMm + t.heightMm + offsetMm + markLengthMm],
    ]
    for (const [x1, y1, x2, y2] of corners) lines.push({ x1Mm: x1, y1Mm: y1, x2Mm: x2, y2Mm: y2 })
  }
  return lines
}

/** Translada o(s) polígono(s) de corte (locais à arte) para a posição absoluta de cada cópia da grade. */
export function computeContourTilePaths(tiles: TilePosition[], contour: CutContour): Point[][] {
  const out: Point[][] = []
  for (const t of tiles) {
    for (const poly of contour) {
      out.push(poly.map((p) => ({ x: t.xMm + p.x, y: t.yMm + p.y })))
    }
  }
  return out
}
