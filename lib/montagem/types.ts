import type { Unit } from './units'

export type AssemblyMode = 'bobina' | 'folha'
export type Rotation = 0 | 90 | 180 | 270
export type SheetPreset = 'A4' | 'A3' | 'A5' | 'custom'

export interface MarginsMm {
  top: number
  right: number
  bottom: number
  left: number
}

export interface SpacingMm {
  x: number
  y: number
}

export interface ImportedArt {
  name: string
  /** 'shape': forma simples (quadrado/retângulo ou círculo) criada sem arquivo, só para calcular aproveitamento. */
  kind: 'image' | 'pdf' | 'shape'
  /** Imagem já rotacionada conforme `rotation`, pronta para ser ladrilhada. */
  dataUrl: string
  widthPx: number
  heightPx: number
  /** Dimensão física antes da rotação. */
  widthMm: number
  heightMm: number
  unit: Unit
  rotation: Rotation
  aspectLocked: boolean
  hasAlpha: boolean
  pageCount?: number
  pageIndex?: number
}

export interface BobinaConfig {
  rollWidthMm: number
  /** null quando o comprimento é calculado a partir da quantidade desejada. */
  rollLengthMm: number | null
  desiredQty: number | null
  margins: MarginsMm
  spacing: SpacingMm
  manualCols: number | null
  manualRows: number | null
}

export interface FolhaConfig {
  preset: SheetPreset
  sheetWidthMm: number
  sheetHeightMm: number
  margins: MarginsMm
  spacing: SpacingMm
  desiredQty: number | null
  manualCols: number | null
  manualRows: number | null
}

export interface CropMarksConfig {
  enabled: boolean
  bleedMm: number
  markLengthMm: number
  markOffsetMm: number
}

export interface PackingResult {
  cols: number
  rows: number
  total: number
  rotated: boolean
  itemWidthMm: number
  itemHeightMm: number
  usableWidthMm: number
  usableHeightMm: number
  containerWidthMm: number
  containerHeightMm: number
  usedAreaMm2: number
  totalAreaMm2: number
  wasteAreaMm2: number
  utilizationPct: number
  lengthNeededMm?: number
  fits: boolean
  reason?: string
  manual: boolean
}

export interface PackingComparison {
  best: PackingResult
  normal: PackingResult
  rotated: PackingResult
}

export interface Point {
  x: number
  y: number
}

/** Contorno de corte (faca) local à arte, em mm, origem (0,0) no canto superior-esquerdo da arte. */
export type CutContour = Point[][]
