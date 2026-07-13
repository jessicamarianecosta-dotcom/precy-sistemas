'use client'

const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.82

/**
 * Comprime uma imagem no navegador antes do upload: redimensiona para no
 * máximo 1600px no maior lado e reencoda via Canvas (WEBP, com fallback
 * para JPEG se o navegador não suportar toBlob em WEBP). Mesmo padrão de
 * Canvas já usado em useImageBrightness.ts. Se algo falhar, retorna o
 * arquivo original sem comprimir — nunca bloqueia o upload.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await loadImage(file)
    const { width, height } = scaledSize(bitmap.width, bitmap.height)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const webpBlob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY)
    if (webpBlob && webpBlob.size > 0 && webpBlob.size < file.size) {
      return new File([webpBlob], renameExt(file.name, 'webp'), { type: 'image/webp' })
    }

    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', WEBP_QUALITY)
    if (jpegBlob && jpegBlob.size > 0 && jpegBlob.size < file.size) {
      return new File([jpegBlob], renameExt(file.name, 'jpg'), { type: 'image/jpeg' })
    }

    return file
  } catch {
    return file
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err) }
    img.src = url
  })
}

function scaledSize(width: number, height: number) {
  const longest = Math.max(width, height)
  if (longest <= MAX_DIMENSION) return { width, height }
  const scale = MAX_DIMENSION / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function renameExt(name: string, ext: string) {
  return `${name.replace(/\.[^.]+$/, '')}.${ext}`
}
