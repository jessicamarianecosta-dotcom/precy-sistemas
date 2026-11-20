/**
 * PRECY MONTAGEM — geração da linha de corte (faca) a partir da arte final.
 *
 * Rasteriza a arte (já com fundo removido, se for o caso) numa resolução de
 * trabalho reduzida, extrai a máscara de opacidade e usa o motor de contorno
 * (contourTrace.ts) para traçar o(s) polígono(s) de corte, convertendo o
 * resultado para milímetros no espaço local da própria arte (0,0 no canto
 * superior-esquerdo) — pronto pra ser posicionado em cada cópia da grade.
 */

import { MontagemImportError } from './fileImport'
import { traceMaskContours } from './contourTrace'
import type { CutContour, ImportedArt } from './types'

/** Maior lado (em px) da imagem de trabalho usada para traçar o contorno — suficiente para um traço suave, rápido o bastante para rodar a cada geração. */
const WORKING_LONG_EDGE = 700
const ALPHA_THRESHOLD = 32

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new MontagemImportError('Não foi possível carregar a imagem.'))
    img.src = src
  })
}

export async function generateCutContourForArt(art: ImportedArt, offsetMm: number): Promise<CutContour> {
  if (!art.hasAlpha) {
    throw new MontagemImportError('Esta arte não tem fundo transparente. Use "Remover fundo" antes de gerar a linha de corte.')
  }

  const img = await loadImageElement(art.dataUrl)
  const scale = Math.min(1, WORKING_LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new MontagemImportError('Canvas não suportado neste navegador.')
  ctx.drawImage(img, 0, 0, width, height)

  const { data } = ctx.getImageData(0, 0, width, height)
  const mask = new Uint8Array(width * height)
  for (let p = 0; p < width * height; p++) {
    mask[p] = data[p * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0
  }

  // width e height vêm da MESMA escala a partir da imagem original, então
  // 1px de trabalho vale o mesmo tanto de mm nos dois eixos.
  const mmPerPx = art.widthMm / width
  const offsetPx = offsetMm / mmPerPx

  const contoursPx = traceMaskContours(mask, width, height, {
    dilateIterations: Math.max(0, Math.round(offsetPx)),
    simplifyEpsilon: Math.max(0.5, width / 400),
    minAreaPx: 6,
  })

  if (contoursPx.length === 0) {
    throw new MontagemImportError('Não foi possível detectar o contorno da arte — verifique se a remoção de fundo ficou correta.')
  }

  return contoursPx.map((poly) => poly.map((p) => ({ x: p.x * mmPerPx, y: p.y * mmPerPx })))
}
