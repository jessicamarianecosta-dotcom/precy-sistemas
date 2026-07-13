'use client'

import { useCallback, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { UploadCloud, ImageIcon, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  label:             string
  value:             string | null
  onUploaded:        (url: string) => void
  context:           'logo' | 'banner' | 'seo'
  recommendedSize:   string
  recommendedFormat: string
  maxSizeMb:         number
  /** Classe Tailwind que define a proporção da caixa de preview (ex: 'aspect-square' ou 'aspect-[3.84/1]') */
  previewAspect:     string
  helpText?:         string
  /** Overlay ilustrando a área segura (usado só no Banner) */
  showSafeArea?:     boolean
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Dropzone de imagem com drag-and-drop, preview imediato e barra de
 * progresso real (XHR — fetch não expõe progresso de upload). Substitui o
 * <input type="file"> cru em Logo/Banner/Imagem de SEO do Catálogo Online.
 */
export function ImageUploadField({
  label, value, onUploaded, context, recommendedSize, recommendedFormat, maxSizeMb, previewAspect, helpText, showSafeArea,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const displayImage = localPreview ?? value

  const handleFile = useCallback((file: File) => {
    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Formato não permitido. Use JPG, PNG, WEBP ou GIF.')
      return
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo ${maxSizeMb}MB.`)
      return
    }

    setLocalPreview(URL.createObjectURL(file))
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('context', context)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/catalogo/upload')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      setProgress(null)
      try {
        const json = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && json.url) {
          onUploaded(json.url)
        } else {
          setError(json.error ?? 'Erro ao enviar imagem.')
          setLocalPreview(null)
        }
      } catch {
        setError('Erro ao enviar imagem.')
        setLocalPreview(null)
      }
    }
    xhr.onerror = () => {
      setProgress(null)
      setError('Erro de conexão ao enviar imagem.')
      setLocalPreview(null)
    }
    xhr.send(formData)
  }, [context, maxSizeMb, onUploaded])

  return (
    <div>
      <label className="block text-sm font-semibold text-text-primary dark:text-stone-100 mb-2">{label}</label>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'relative rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden transition-colors flex items-center justify-center bg-surface dark:bg-white/[0.03]',
          previewAspect,
          dragOver ? 'border-primary bg-primary-50 dark:bg-primary/10' : 'border-border dark:border-border-dark hover:border-primary/50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />

        {displayImage ? (
          <img src={displayImage} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-muted p-4 text-center">
            <UploadCloud size={28} />
            <p className="text-xs font-medium">Arraste uma imagem ou clique para escolher</p>
          </div>
        )}

        {showSafeArea && !progress && (
          <div className="absolute inset-y-0 left-[10%] right-[10%] border-x-2 border-dashed border-white/70 pointer-events-none" />
        )}

        {progress !== null && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 size={20} className="animate-spin" />
            <div className="w-2/3 h-1.5 rounded-full bg-white/30 overflow-hidden">
              <div className="h-full bg-white transition-all duration-150" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-semibold">{progress}%</span>
          </div>
        )}

        {!displayImage && !progress && (
          <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white dark:bg-surface-dark shadow-sm text-text-muted">
            <ImageIcon size={13} />
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-[11px] text-text-muted dark:text-stone-500">
          <strong>Recomendado:</strong> {recommendedSize} · {recommendedFormat} · Máximo {maxSizeMb}MB
        </p>
        {helpText && <p className="text-[11px] text-text-muted dark:text-stone-500">{helpText}</p>}
        {error && (
          <p className="flex items-center gap-1 text-[11px] text-error dark:text-red-400">
            <AlertCircle size={11} /> {error}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="btn-secondary text-xs mt-2 w-full sm:w-auto"
      >
        {value ? 'Alterar imagem' : 'Escolher imagem'}
      </button>
    </div>
  )
}
