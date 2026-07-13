'use client'

/**
 * Upload de imagem via XMLHttpRequest (não fetch — fetch não expõe progresso
 * de upload) contra /api/catalogo/upload. Compartilhado por ImageUploadField
 * (logo/banner/seo) e ProductGalleryUpload (fotos de produto).
 */
export function uploadImageXhr(
  file: File,
  params: { context?: string; productId?: string },
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    if (params.context) formData.append('context', params.context)
    if (params.productId) formData.append('productId', params.productId)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/catalogo/upload')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && json.url) {
          resolve(json.url)
        } else {
          reject(new Error(json.error ?? 'Erro ao enviar imagem.'))
        }
      } catch {
        reject(new Error('Erro ao enviar imagem.'))
      }
    }
    xhr.onerror = () => reject(new Error('Erro de conexão ao enviar imagem.'))
    xhr.send(formData)
  })
}
