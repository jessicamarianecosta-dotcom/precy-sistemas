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
import { traceMaskContours, erodeMaskByRadius } from './contourTrace'
import type { CutContour, ImportedArt } from './types'

/** Maior lado (em px) da imagem de trabalho usada para traçar o contorno — alto o bastante para preservar pontas finas (letras, raios), com custo controlado pela transformada de distância (não cresce com o deslocamento pedido). */
const WORKING_LONG_EDGE = 1400
const ALPHA_THRESHOLD = 32

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new MontagemImportError('Não foi possível carregar a imagem.'))
    img.src = src
  })
}

/**
 * `offsetMm` é a distância final pretendida a partir da arte ORIGINAL (sem
 * borda) — pode ser negativa em relação à borda já aplicada na arte (ex:
 * borda de 2mm usada como sangria, com a faca a só 1mm da arte): nesse caso
 * a imagem já vem com a borda desenhada, então em vez de dilatar, precisamos
 * encolher (erodir) a máscara de volta pra que a faca fique a `offsetMm` da
 * arte original, mesmo que isso a deixe dentro da área da borda.
 */
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

  // offsetMm negativo (faca mais perto da arte do que a borda já aplicada,
  // ex: borda-sangria) — encolhe a máscara de volta em vez de crescer.
  const workingMask = offsetPx < 0 ? erodeMaskByRadius(mask, width, height, -offsetPx) : mask

  const contoursPx = traceMaskContours(workingMask, width, height, {
    // Raio euclidiano exato (não arredonda pra inteiro) — a transformada de
    // distância aceita qualquer valor sem custo extra.
    dilateIterations: Math.max(0, offsetPx),
    // Epsilon pequeno o bastante pra manter pontas finas (ex: raios, pontas
    // de letras) em vez de arredondá-las na simplificação.
    simplifyEpsilon: Math.max(0.35, width / 1000),
    minAreaPx: 6,
  })

  if (contoursPx.length === 0) {
    throw new MontagemImportError('Não foi possível detectar o contorno da arte — verifique se a remoção de fundo ficou correta.')
  }

  return contoursPx.map((poly) => poly.map((p) => ({ x: p.x * mmPerPx, y: p.y * mmPerPx })))
}
