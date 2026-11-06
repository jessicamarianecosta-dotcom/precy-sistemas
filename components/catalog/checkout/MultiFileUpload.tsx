'use client'

import { useRef, useState } from 'react'
import { Loader2, Paperclip, X, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { uploadArtFile } from '@/lib/catalog/checkout/uploadArtFile'
import type { UploadedArtFile } from '@/lib/catalog/checkout/useCheckoutState'

interface MultiFileUploadProps {
  slug: string
  files: UploadedArtFile[]
  onChange: (files: UploadedArtFile[]) => void
  label: string
  accept?: string
}

/**
 * Upload múltiplo de arquivos (arte própria ou referências visuais),
 * com visualização, remoção e substituição antes de finalizar — tudo
 * vinculado a UM item do carrinho (quem chama já isola por itemKey).
 */
export function MultiFileUpload({ slug, files, onChange, label, accept }: MultiFileUploadProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      const uploaded: UploadedArtFile[] = []
      for (const file of Array.from(fileList)) {
        try {
          uploaded.push(await uploadArtFile(slug, file))
        } catch (err: any) {
          toast('error', err.message ?? `Erro ao enviar "${file.name}"`)
        }
      }
      if (uploaded.length > 0) onChange([...files, ...uploaded])
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(idx: number) {
    onChange(files.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      <label
        className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border border-dashed cursor-pointer transition-colors"
        style={{ borderColor: 'var(--store-border)', color: 'var(--store-text-secondary)' }}
      >
        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {uploading ? 'Enviando...' : label}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          disabled={uploading}
          onChange={e => handleFiles(e.target.files)}
        />
      </label>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, idx) => (
            <li
              key={`${f.path}-${idx}`}
              className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg"
              style={{ backgroundColor: 'var(--store-surface)' }}
            >
              <Paperclip size={12} className="shrink-0" style={{ color: 'var(--store-text-secondary)' }} />
              <span className="flex-1 truncate" style={{ color: 'var(--store-text)' }}>{f.fileName}</span>
              <button type="button" onClick={() => removeAt(idx)} className="shrink-0 hover:opacity-70">
                <X size={13} style={{ color: 'var(--store-text-secondary)' }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
