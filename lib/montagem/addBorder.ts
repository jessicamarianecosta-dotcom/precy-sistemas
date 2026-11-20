/**
 * PRECY MONTAGEM — adiciona uma borda sólida ao redor da arte (depois da
 * remoção de fundo), crescendo a silhueta por uma distância em mm e
 * preenchendo o anel novo com uma cor (branca, preta ou qualquer outra,
 * inclusive pipetada da própria arte via o seletor de cor nativo do
 * navegador). A arte física (mm) cresce de verdade — a faca gerada depois
 * acompanha essa nova silhueta maior, cortando ao redor da borda.
 */

import { MontagemImportError } from './fileImport'
import { dilateMaskByRadius } from './contourTrace'
import type { ImportedArt } from './types'

/** Maior lado de trabalho (px) — processa nessa resolução e devolve nela mesma; alta o bastante para manter boa densidade de impressão. */
const MAX_BORDER_WORKING_LONG_EDGE = 2400
const ALPHA_THRESHOLD = 32

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new MontagemImportError('Não foi possível carregar a imagem.'))
    img.src = src
  })
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export interface AddBorderOptions {
  widthMm: number
  /** Cor em hex, ex: "#ffffff". */
  color: string
}

/**
 * `baseArt` deve ser a arte já com fundo removido (hasAlpha true) e ANTES de
 * qualquer borda já adicionada — como a remoção de fundo, isso roda sobre o
 * `originalArt` (ou o resultado dela) dentro do pipeline da store, nunca
 * incrementalmente sobre uma arte já bordeada.
 */
export async function addBorderToArt(baseArt: ImportedArt, opts: AddBorderOptions): Promise<ImportedArt> {
  if (!baseArt.hasAlpha) {
    throw new MontagemImportError('Esta arte não tem fundo transparente. Use "Remover fundo" antes de adicionar uma borda.')
  }
  if (opts.widthMm <= 0) return baseArt

  const img = await loadImageElement(baseArt.dataUrl)
  const scale = Math.min(1, MAX_BORDER_WORKING_LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const baseW = Math.max(1, Math.round(img.naturalWidth * scale))
  const baseH = Math.max(1, Math.round(img.naturalHeight * scale))

  const mmPerPx = baseArt.widthMm / baseW
  const borderPx = Math.max(1, opts.widthMm / mmPerPx)
  const paddingPx = Math.ceil(borderPx) + 2

  const paddedW = baseW + paddingPx * 2
  const paddedH = baseH + paddingPx * 2

  const canvas = document.createElement('canvas')
  canvas.width = paddedW
  canvas.height = paddedH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new MontagemImportError('Canvas não suportado neste navegador.')
  ctx.drawImage(img, paddingPx, paddingPx, baseW, baseH)

  const imageData = ctx.getImageData(0, 0, paddedW, paddedH)
  const data = imageData.data

  const mask = new Uint8Array(paddedW * paddedH)
  for (let p = 0; p < mask.length; p++) mask[p] = data[p * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0

  const dilated = dilateMaskByRadius(mask, paddedW, paddedH, borderPx)
  const { r, g, b } = hexToRgb(opts.color)

  for (let p = 0; p < mask.length; p++) {
    if (dilated[p] === 1 && mask[p] === 0) {
      const i = p * 4
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)

  return {
    ...baseArt,
    dataUrl: canvas.toDataURL('image/png'),
    widthPx: paddedW,
    heightPx: paddedH,
    widthMm: baseArt.widthMm + opts.widthMm * 2,
    heightMm: baseArt.heightMm + opts.widthMm * 2,
  }
}
