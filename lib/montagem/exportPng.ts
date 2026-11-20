import { computeCropMarks, computeTilePositions, type TilePosition } from './layout'
import type { CropMarksConfig, PackingResult } from './types'

const MM_TO_IN = 1 / 25.4

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Falha ao carregar a arte para exportação.'))
    img.src = src
  })
}

export interface ExportOptions {
  dpi: number
  transparentBg: boolean
  cropMarks: CropMarksConfig
}

export async function renderMontagemToCanvas(
  result: PackingResult,
  marginLeftMm: number,
  marginTopMm: number,
  spacingXMm: number,
  spacingYMm: number,
  imageDataUrl: string,
  opts: ExportOptions,
): Promise<HTMLCanvasElement> {
  const pxPerMm = opts.dpi * MM_TO_IN
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(result.containerWidthMm * pxPerMm))
  canvas.height = Math.max(1, Math.round(result.containerHeightMm * pxPerMm))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado neste navegador.')

  if (!opts.transparentBg) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const img = await loadImage(imageDataUrl)
  const tiles: TilePosition[] = computeTilePositions(result, marginLeftMm, marginTopMm, spacingXMm, spacingYMm)

  ctx.imageSmoothingEnabled = true
  ;(ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality = 'high'
  for (const t of tiles) {
    ctx.drawImage(img, t.xMm * pxPerMm, t.yMm * pxPerMm, t.widthMm * pxPerMm, t.heightMm * pxPerMm)
  }

  if (opts.cropMarks.enabled) {
    const marks = computeCropMarks(tiles, opts.cropMarks.markLengthMm, opts.cropMarks.markOffsetMm)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = Math.max(1, 0.15 * pxPerMm)
    for (const m of marks) {
      ctx.beginPath()
      ctx.moveTo(m.x1Mm * pxPerMm, m.y1Mm * pxPerMm)
      ctx.lineTo(m.x2Mm * pxPerMm, m.y2Mm * pxPerMm)
      ctx.stroke()
    }
  }

  return canvas
}

export async function exportPng(
  result: PackingResult,
  marginLeftMm: number,
  marginTopMm: number,
  spacingXMm: number,
  spacingYMm: number,
  imageDataUrl: string,
  opts: ExportOptions,
): Promise<Blob> {
  const canvas = await renderMontagemToCanvas(result, marginLeftMm, marginTopMm, spacingXMm, spacingYMm, imageDataUrl, opts)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG.'))), 'image/png')
  })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
