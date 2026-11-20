/**
 * PRECY MONTAGEM — exporta a linha de corte (faca) como arquivo separado,
 * sem a imagem, no mesmo tamanho de página e nas mesmas coordenadas do
 * arquivo com a arte — basta abrir os dois no software de corte (CorelDRAW,
 * FlexiSign, SignCut) para eles ficarem alinhados automaticamente, sem
 * precisar arrastar nada manualmente.
 */

import jsPDF from 'jspdf'
import { computeContourTilePaths, computeTilePositions } from './layout'
import type { CutContour, PackingResult } from './types'
import { downloadBlob } from './exportPng'

export function exportCutContourPdf(
  result: PackingResult,
  marginLeftMm: number,
  marginTopMm: number,
  spacingXMm: number,
  spacingYMm: number,
  cutContour: CutContour,
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
  const paths = computeContourTilePaths(tiles, cutContour)

  doc.setDrawColor(255, 0, 255)
  doc.setLineWidth(0.1)
  for (const path of paths) {
    for (let i = 0; i < path.length; i++) {
      const a = path[i]
      const b = path[(i + 1) % path.length]
      doc.line(a.x, a.y, b.x, b.y)
    }
  }

  const blob = doc.output('blob')
  downloadBlob(blob, fileName)
}

export function exportCutContourSvg(
  result: PackingResult,
  marginLeftMm: number,
  marginTopMm: number,
  spacingXMm: number,
  spacingYMm: number,
  cutContour: CutContour,
  fileName: string,
) {
  const tiles = computeTilePositions(result, marginLeftMm, marginTopMm, spacingXMm, spacingYMm)
  const paths = computeContourTilePaths(tiles, cutContour)

  const pathsMarkup = paths
    .map((path) => {
      const d = `${path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')} Z`
      return `<path d="${d}" fill="none" stroke="#FF00FF" stroke-width="0.1"/>`
    })
    .join('\n')

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${result.containerWidthMm}mm" height="${result.containerHeightMm}mm" viewBox="0 0 ${result.containerWidthMm} ${result.containerHeightMm}">`,
    pathsMarkup,
    '</svg>',
  ].join('\n')

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  downloadBlob(blob, fileName)
}
