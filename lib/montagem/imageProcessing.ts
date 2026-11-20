/**
 * PRECY MONTAGEM — recorte automático de fundo e melhoria de definição.
 *
 * As duas operações são determinísticas (sem IA generativa): recorte por
 * detecção de bordas (bounding box de pixels que não são fundo) e upscale
 * por reamostragem + realce de nitidez (unsharp mask). Nenhuma delas
 * recria, inventa ou recolore conteúdo da arte — só cortam o que já é
 * fundo e aumentam a densidade de pixels existente.
 */

import { MontagemImportError } from './fileImport'
import type { ImportedArt } from './types'

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new MontagemImportError('Não foi possível carregar a imagem.'))
    img.src = src
  })
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new MontagemImportError('Canvas não suportado neste navegador.')
  return ctx
}

/**
 * Recorta a imagem na menor caixa que contém toda a arte, removendo a
 * margem de fundo (branco ou transparente) ao redor. A medida física (mm)
 * é recalculada proporcionalmente ao recorte, para refletir o tamanho real
 * da arte — não mais o tamanho do fundo onde ela estava.
 */
export async function trimBackground(art: ImportedArt, tolerance = 18): Promise<ImportedArt> {
  const img = await loadImageElement(art.dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = get2dContext(canvas)
  ctx.drawImage(img, 0, 0)

  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)

  // Cor de referência do fundo: média dos 4 cantos (mais robusto que 1 pixel
  // só, contra ruído de compressão JPEG perto da borda).
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ]
  let bgR = 0, bgG = 0, bgB = 0
  for (const i of corners) { bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2] }
  bgR /= 4; bgG /= 4; bgB /= 4

  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4
    for (let x = 0; x < width; x++) {
      const i = rowOffset + x * 4
      const a = data[i + 3]
      const isBackground = a === 0 || (
        Math.abs(data[i] - bgR) <= tolerance &&
        Math.abs(data[i + 1] - bgG) <= tolerance &&
        Math.abs(data[i + 2] - bgB) <= tolerance
      )
      if (!isBackground) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new MontagemImportError('Não foi possível detectar a arte: a imagem parece estar totalmente em branco.')
  }

  const trimmedW = maxX - minX + 1
  const trimmedH = maxY - minY + 1

  // Já está no limite (nada pra cortar) — evita um recorte de 1px por ruído.
  if (trimmedW >= width - 1 && trimmedH >= height - 1) return art

  const out = document.createElement('canvas')
  out.width = trimmedW
  out.height = trimmedH
  const outCtx = get2dContext(out)
  outCtx.drawImage(canvas, minX, minY, trimmedW, trimmedH, 0, 0, trimmedW, trimmedH)

  const mmPerPxX = art.widthMm / art.widthPx
  const mmPerPxY = art.heightMm / art.heightPx

  return {
    ...art,
    dataUrl: out.toDataURL('image/png'),
    widthPx: trimmedW,
    heightPx: trimmedH,
    widthMm: trimmedW * mmPerPxX,
    heightMm: trimmedH * mmPerPxY,
  }
}

/** Maior lado, em pixels, que o upscale pode gerar — protege de travar o navegador em arquivos já grandes. */
const MAX_UPSCALE_LONG_EDGE = 6000

function unsharpMask(canvas: HTMLCanvasElement, amount = 0.35): HTMLCanvasElement {
  const ctx = get2dContext(canvas)
  const { width, height } = canvas
  const src = ctx.getImageData(0, 0, width, height)
  const srcData = src.data
  const out = ctx.createImageData(width, height)
  const outData = out.data

  // Blur 3x3 simples (box blur) como base do unsharp mask: resultado =
  // original + amount * (original - blur). Realça bordas sem alterar o
  // matiz/saturação de áreas uniformes (blur ali ≈ original, delta ≈ 0).
  const idx = (x: number, y: number) => (y * width + x) * 4
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y)
      for (let c = 0; c < 3; c++) {
        let sum = 0, count = 0
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= width) continue
            sum += srcData[idx(nx, ny) + c]
            count++
          }
        }
        const blurred = sum / count
        const original = srcData[i + c]
        outData[i + c] = clamp8(original + amount * (original - blurred))
      }
      outData[i + 3] = srcData[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/**
 * Aumenta a resolução da arte (2x, 3x ou 4x) via reamostragem de alta
 * qualidade do navegador + leve realce de nitidez. O tamanho físico (mm)
 * não muda — só a densidade de pixels, pra imprimir com mais definição.
 */
export async function upscaleImage(art: ImportedArt, factor: 2 | 3 | 4): Promise<ImportedArt> {
  const img = await loadImageElement(art.dataUrl)

  let targetFactor: number = factor
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight) * factor
  if (longEdge > MAX_UPSCALE_LONG_EDGE) {
    targetFactor = Math.max(1, MAX_UPSCALE_LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  }
  if (targetFactor <= 1) {
    throw new MontagemImportError('Esta arte já está perto do limite de resolução máxima suportado.')
  }

  const finalW = Math.round(img.naturalWidth * targetFactor)
  const finalH = Math.round(img.naturalHeight * targetFactor)

  // Upscala em passos de 2x — cada passo usa a reamostragem de alta
  // qualidade do próprio navegador (bicúbica), o que funciona melhor do
  // que pular direto para um fator grande numa única passada.
  let current = document.createElement('canvas')
  current.width = img.naturalWidth
  current.height = img.naturalHeight
  get2dContext(current).drawImage(img, 0, 0)

  while (current.width < finalW) {
    const next = document.createElement('canvas')
    next.width = Math.min(finalW, current.width * 2)
    next.height = Math.min(finalH, current.height * 2)
    const ctx = get2dContext(next)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(current, 0, 0, next.width, next.height)
    current = next
  }

  const sharpened = unsharpMask(current)

  return {
    ...art,
    dataUrl: sharpened.toDataURL('image/png'),
    widthPx: finalW,
    heightPx: finalH,
  }
}
