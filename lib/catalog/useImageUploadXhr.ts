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

export interface UploadedFile {
  url: string
  path: string
  mimeType: string
  fileSize: number
}

/**
 * Versão de uploadImageXhr que devolve os metadados completos (path/mime/
 * tamanho) em vez de só a URL — usados pela galeria de mídia (product_images)
 * para preencher storage_path/mime_type/file_size e permitir apagar o
 * arquivo do Storage depois (ver DELETE /api/catalogo/upload). Suporta
 * também vídeo (mediaType: 'video' + duration medida no navegador).
 */
export function uploadFileXhr(
  file: File,
  params: { productId: string; mediaType?: 'image' | 'video'; duration?: number },
  onProgress?: (percent: number) => void
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('productId', params.productId)
    formData.append('context', 'product')
    if (params.mediaType) formData.append('mediaType', params.mediaType)
    if (params.duration != null) formData.append('duration', String(params.duration))

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/catalogo/upload')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && json.url) {
          resolve({ url: json.url, path: json.path, mimeType: json.mimeType, fileSize: json.fileSize })
        } else {
          reject(new Error(json.error ?? 'Erro ao enviar arquivo.'))
        }
      } catch {
        reject(new Error('Erro ao enviar arquivo.'))
      }
    }
    xhr.onerror = () => reject(new Error('Erro de conexão ao enviar arquivo.'))
    xhr.send(formData)
  })
}
