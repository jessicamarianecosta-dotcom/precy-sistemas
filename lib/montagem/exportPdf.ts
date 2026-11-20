import jsPDF from 'jspdf'
import { computeCropMarks, computeTilePositions } from './layout'
import type { CropMarksConfig, PackingResult } from './types'
import { downloadBlob } from './exportPng'

export interface PdfExportOptions {
  cropMarks: CropMarksConfig
  /**
   * 'white' desenha um retângulo branco atrás de cada peça antes da imagem
   * (garante fundo sólido mesmo se a arte tiver pixels transparentes).
   * 'transparent' não desenha nada atrás — onde a arte for transparente,
   * aparece o papel (a página do PDF já é branca por padrão).
   */
  background: 'white' | 'transparent'
}

export function exportPdf(
  result: PackingResult,
  marginLeftMm: number,
  marginTopMm: number,
  spacingXMm: number,
  spacingYMm: number,
  imageDataUrl: string,
  opts: PdfExportOptions,
  fileName: string,
) {
  const orientation = result.containerWidthMm >= result.containerHeightMm ? 'landscape' : 'portrait'
  const doc = new jsPDF({
    unit: 'mm',
    orientation,
    format: [result.containerWidthMm, result.containerHeightMm],
    compress: true,
  })

  const tiles = computeTilePositions(result, marginLeftMm, marginTopMm, spacingXMm, spacingYMm)
  for (const t of tiles) {
    if (opts.background === 'white') {
      doc.setFillColor(255, 255, 255)
      doc.rect(t.xMm, t.yMm, t.widthMm, t.heightMm, 'F')
    }
    doc.addImage(imageDataUrl, 'PNG', t.xMm, t.yMm, t.widthMm, t.heightMm, undefined, 'MEDIUM')
  }

  if (opts.cropMarks.enabled) {
    const marks = computeCropMarks(tiles, opts.cropMarks.markLengthMm, opts.cropMarks.markOffsetMm)
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.15)
    for (const m of marks) {
      doc.line(m.x1Mm, m.y1Mm, m.x2Mm, m.y2Mm)
    }
  }

  const blob = doc.output('blob')
  downloadBlob(blob, fileName)
}
