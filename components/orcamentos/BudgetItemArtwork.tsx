'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Document, Page } from 'react-pdf'
import '@/lib/utils/pdfWorker'
import { Paperclip, Eye, RefreshCw, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { getFileKind, formatFileSize } from '@/lib/utils/fileIcons'
import { OrderFileViewerModal } from '@/components/orders/OrderFileViewerModal'
import type { BudgetItemFile } from './types'

interface Props {
  budgetId: string
  budgetItemId: string
  file: BudgetItemFile | null
  onChanged: () => void
}

/* Mesma allowlist de extensões aceita em Pedidos (components/orders/OrderFilesSection.tsx) */
const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.ai,.eps,.cdr,.zip,.rar'

export function BudgetItemArtwork({ budgetId, budgetItemId, file, onChanged }: Props) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'idle' | 'uploading' | 'removing'>('idle')

  async function doUpload(picked: File, replacing: BudgetItemFile | null) {
    setError(null)
    setMode('uploading')
    try {
      const body = new FormData()
      body.append('file', picked)
      body.append('budgetId', budgetId)
      body.append('budgetItemId', budgetItemId)
      const res = await fetch('/api/orcamentos/upload-arquivo', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar arquivo')
      // Só remove a arte antiga depois que a nova foi enviada com sucesso —
      // evita ficar sem nenhuma arte caso o upload falhe no meio do caminho.
      if (replacing) {
        await supabase.storage.from('order-files').remove([replacing.file_path])
        await (supabase.from('budget_item_files') as any).delete().eq('id', replacing.id)
      }
      onChanged()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao enviar arquivo')
    } finally {
      setMode('idle')
    }
  }

  async function doRemove() {
    if (!file) return
    if (!confirm(`Remover "${file.file_name}"?`)) return
    setError(null)
    setMode('removing')
    try {
      await supabase.storage.from('order-files').remove([file.file_path])
      const { error: delErr } = await (supabase.from('budget_item_files') as any).delete().eq('id', file.id)
      if (delErr) throw delErr
      onChanged()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao remover arquivo')
    } finally {
      setMode('idle')
    }
  }

  function handlePicked(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    doUpload(fileList[0], file)
  }

  const kind = file ? getFileKind(file.file_name) : null

  return (
    <div className="pt-2.5 border-t border-border dark:border-stone-800">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPT}
        onChange={e => { handlePicked(e.target.files); e.target.value = '' }}
      />

      {!file ? (
        <button
          type="button"
          disabled={mode === 'uploading'}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-border dark:border-stone-700 text-[11px] font-medium text-text-muted hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          {mode === 'uploading' ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
          {mode === 'uploading' ? 'Enviando arte...' : 'Adicionar arte'}
        </button>
      ) : (
        <div className="flex items-center gap-2.5">
          {kind?.isImage ? (
            <img src={file.file_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-border dark:border-border-dark" />
          ) : kind?.isPdf ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-border dark:border-border-dark bg-white flex items-center justify-center">
              <Document file={file.file_url} loading={<Loader2 size={12} className="animate-spin text-text-muted" />} error={<kind.Icon size={14} className="text-text-muted" />}>
                <Page pageNumber={1} width={36} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg flex-shrink-0 border border-border dark:border-border-dark bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
              {kind && <kind.Icon size={16} className="text-primary" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-text-primary dark:text-stone-100 truncate">{file.file_name}</p>
            <p className="text-[10px] text-text-muted dark:text-stone-500">{formatFileSize(file.file_size)}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button type="button" title="Visualizar" onClick={() => setViewing(true)}
              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors">
              <Eye size={13} />
            </button>
            <button type="button" title="Substituir" disabled={mode !== 'idle'} onClick={() => inputRef.current?.click()}
              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
              {mode === 'uploading' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
            <button type="button" title="Remover" disabled={mode !== 'idle'} onClick={doRemove}
              className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light dark:hover:bg-error/10 transition-colors disabled:opacity-50">
              {mode === 'removing' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1 text-[11px] text-error mt-1.5"><AlertCircle size={11} /> {error}</p>
      )}

      {viewing && file && <OrderFileViewerModal file={file} onClose={() => setViewing(false)} />}
    </div>
  )
}
