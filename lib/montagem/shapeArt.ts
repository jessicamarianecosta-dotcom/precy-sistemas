/**
 * PRECY MONTAGEM — forma simples (quadrado/retângulo ou círculo) usada como
 * base de cálculo quando o cliente ainda não mandou a arte final. Gera um
 * placeholder visual (sem precisar de nenhum arquivo) com a medida exata
 * informada, pronto para ser usado em todo o resto do sistema (cálculo de
 * encaixe, visualização, exportação) exatamente como uma arte importada.
 */

import { MontagemImportError } from './fileImport'
import type { ImportedArt } from './types'

export type SimpleShape = 'rect' | 'circle'

/** px de trabalho por mm — baixo o bastante pra ser leve, alto o bastante pra não serrilhar na tela. */
const WORKING_PX_PER_MM = 8

export function createShapeArt(shape: SimpleShape, widthMm: number, heightMm: number): ImportedArt {
  if (widthMm <= 0 || heightMm <= 0) {
    throw new MontagemImportError('Informe uma medida maior que zero.')
  }

  const widthPx = Math.max(2, Math.round(widthMm * WORKING_PX_PER_MM))
  const heightPx = Math.max(2, Math.round(heightMm * WORKING_PX_PER_MM))

  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new MontagemImportError('Canvas não suportado neste navegador.')

  const lineWidth = Math.max(1, Math.round(WORKING_PX_PER_MM * 0.3))
  ctx.fillStyle = '#E8DCC8'
  ctx.strokeStyle = '#8B6C4F'
  ctx.lineWidth = lineWidth

  if (shape === 'circle') {
    const cx = widthPx / 2, cy = heightPx / 2
    const rx = Math.max(0, widthPx / 2 - lineWidth / 2)
    const ry = Math.max(0, heightPx / 2 - lineWidth / 2)
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    const inset = lineWidth / 2
    ctx.fillRect(inset, inset, widthPx - lineWidth, heightPx - lineWidth)
    ctx.strokeRect(inset, inset, widthPx - lineWidth, heightPx - lineWidth)
  }

  const name = shape === 'circle'
    ? `Círculo ${fmt(widthMm)} × ${fmt(heightMm)} mm`
    : `Retângulo ${fmt(widthMm)} × ${fmt(heightMm)} mm`

  return {
    name,
    kind: 'shape',
    dataUrl: canvas.toDataURL('image/png'),
    widthPx, heightPx,
    widthMm, heightMm,
    unit: 'mm',
    rotation: 0,
    aspectLocked: shape === 'circle',
    hasAlpha: shape === 'circle',
  }
}

function fmt(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(1).replace('.', ',')
}
