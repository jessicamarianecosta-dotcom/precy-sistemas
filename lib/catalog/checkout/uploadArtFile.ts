import type { UploadedArtFile } from './useCheckoutState'

/**
 * Envia um arquivo de arte/referência para a rota pública existente
 * (/api/loja/upload-arte) — mesma rota usada no checkout antes da
 * reformulação, reaproveitada aqui para múltiplos arquivos por item.
 */
export async function uploadArtFile(slug: string, file: File): Promise<UploadedArtFile> {
  const body = new FormData()
  body.append('file', file)
  body.append('slug', slug)
  const res = await fetch('/api/loja/upload-arte', { method: 'POST', body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Erro ao enviar "${file.name}"`)
  return { url: data.url, path: data.path, fileName: data.fileName, fileSize: data.fileSize, mimeType: data.mimeType }
}
