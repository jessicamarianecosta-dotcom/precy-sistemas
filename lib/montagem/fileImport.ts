/**
 * PRECY MONTAGEM — importação de arquivos (PNG/JPG e PDF).
 *
 * Roda inteiramente no navegador (Canvas + pdf.js): o arquivo do usuário
 * nunca é enviado a um servidor, o que satisfaz de uma vez a exigência de
 * "não armazenar arquivos enviados" tanto na rota pública quanto na interna.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ptToMm } from './units'
import type { ImportedArt, Rotation } from './types'

/**
 * `react-pdf`/`pdfjs-dist` referencia `DOMMatrix` (só existe no browser) no
 * topo do módulo — importar estaticamente quebra a renderização no servidor
 * (SSR/prerender) mesmo em componentes 'use client'. Por isso o import é
 * sempre dinâmico, disparado só em runtime no navegador.
 */
async function loadPdfjs() {
  const { pdfjs } = await import('react-pdf')
  await import('@/lib/utils/pdfWorker')
  return pdfjs
}

export const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024 // 40MB
export const MAX_PDF_PAGES = 50
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

export class MontagemImportError extends Error {}

function assertAccepted(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new MontagemImportError(`Arquivo muito grande (máx. ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB).`)
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new MontagemImportError('Formato não suportado. Envie PNG, JPG ou PDF.')
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new MontagemImportError('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new MontagemImportError('Não foi possível carregar a imagem.'))
    img.src = src
  })
}

/** Detecta se a imagem tem pixels com alfa < 255 (fundo transparente real). */
function detectAlpha(img: HTMLImageElement): boolean {
  const canvas = document.createElement('canvas')
  const w = (canvas.width = Math.min(img.naturalWidth, 64))
  const h = (canvas.height = Math.min(img.naturalHeight, 64))
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

/** DPI assumido para converter px → mm quando o arquivo não traz dimensão física (PNG/JPG). */
const ASSUMED_DPI = 300

export async function importImageFile(file: File): Promise<ImportedArt> {
  assertAccepted(file)
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImageElement(dataUrl)
  const hasAlpha = file.type === 'image/png' && detectAlpha(img)

  const widthMm = (img.naturalWidth / ASSUMED_DPI) * 25.4
  const heightMm = (img.naturalHeight / ASSUMED_DPI) * 25.4

  return {
    name: file.name,
    kind: 'image',
    dataUrl,
    widthPx: img.naturalWidth,
    heightPx: img.naturalHeight,
    widthMm, heightMm,
    unit: 'mm',
    rotation: 0,
    aspectLocked: true,
    hasAlpha,
  }
}

export interface PdfHandle {
  doc: PDFDocumentProxy
  numPages: number
}

export async function openPdfFile(file: File): Promise<PdfHandle> {
  assertAccepted(file)
  const pdfjs = await loadPdfjs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  if (doc.numPages > MAX_PDF_PAGES) {
    throw new MontagemImportError(`PDF com muitas páginas (máx. ${MAX_PDF_PAGES}).`)
  }
  return { doc, numPages: doc.numPages }
}

const PDF_RENDER_DPI = 300

export async function renderPdfPage(handle: PdfHandle, pageIndex: number, fileName: string): Promise<ImportedArt> {
  const page = await handle.doc.getPage(pageIndex)
  const view = page.view // [x0, y0, x1, y1] em pontos
  const widthPt = view[2] - view[0]
  const heightPt = view[3] - view[1]
  const widthMm = ptToMm(widthPt)
  const heightMm = ptToMm(heightPt)

  const scale = PDF_RENDER_DPI / 72
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new MontagemImportError('Não foi possível renderizar o PDF.')

  // @ts-expect-error — 'background' é aceito pelo pdf.js em runtime mas não está no tipo desta versão.
  await page.render({ canvasContext: ctx, viewport, background: 'rgba(255,255,255,1)' }).promise

  return {
    name: fileName,
    kind: 'pdf',
    dataUrl: canvas.toDataURL('image/png'),
    widthPx: canvas.width,
    heightPx: canvas.height,
    widthMm, heightMm,
    unit: 'mm',
    rotation: 0,
    aspectLocked: true,
    hasAlpha: false,
    pageCount: handle.numPages,
    pageIndex,
  }
}

/**
 * Gira a imagem fisicamente (canvas) e devolve um novo bitmap já com as
 * dimensões trocadas — assim o resto do sistema (preview, export) nunca
 * precisa lidar com rotação em tempo de desenho, só ladrilhar retângulos.
 *
 * IMPORTANTE: `baseArt` deve sempre ser a arte original (rotation: 0), nunca
 * um resultado anterior desta função — a rotação aplicada aqui é absoluta,
 * não incremental. O estado que mantém a arte original e a rotação atual
 * (ex: a store do editor) é responsável por sempre chamar a partir do
 * original para evitar rotações acumuladas incorretas.
 */
export async function rotateArt(baseArt: ImportedArt, rotation: Rotation): Promise<ImportedArt> {
  const art = baseArt
  if (rotation === 0) return { ...art, rotation: 0 }
  const img = await loadImageElement(art.dataUrl)

  const swapped = rotation === 90 || rotation === 270
  const canvas = document.createElement('canvas')
  canvas.width = swapped ? img.naturalHeight : img.naturalWidth
  canvas.height = swapped ? img.naturalWidth : img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new MontagemImportError('Não foi possível rotacionar a arte.')

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  return {
    ...art,
    dataUrl: canvas.toDataURL('image/png'),
    widthPx: canvas.width,
    heightPx: canvas.height,
    widthMm: swapped ? art.heightMm : art.widthMm,
    heightMm: swapped ? art.widthMm : art.heightMm,
    rotation,
  }
}
