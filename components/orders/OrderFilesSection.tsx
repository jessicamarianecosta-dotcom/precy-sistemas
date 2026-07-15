'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Document, Page } from 'react-pdf'
import '@/lib/utils/pdfWorker'
import {
  FolderOpen, Eye, Download, Trash2, Loader2, AlertCircle, Upload, CheckCircle2, History, Clock,
} from 'lucide-react'
import { clsx } from 'clsx'
import { getFileKind, getDownloadUrl, formatFileSize } from '@/lib/utils/fileIcons'
import { OrderFileViewerModal } from './OrderFileViewerModal'
import { RequestNewArtModal } from './RequestNewArtModal'
import {
  ART_STATUS_LABELS, ART_STATUS_COLORS, FILE_STATUS_LABELS,
  type ArtStatus, type OrderFile, type OrderFileStatus, type OrderArtEvent,
} from './types'

interface Props {
  orderId: string
  companyId: string
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
}

const STATUS_OPTIONS: OrderFileStatus[] = ['nao_conferido', 'conferido', 'aguardando_cliente', 'aprovado', 'necessita_alteracao']

function FileThumb({ file }: { file: OrderFile }) {
  const kind = getFileKind(file.file_name)
  if (kind.isImage) {
    return <img src={file.file_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-border dark:border-border-dark" />
  }
  if (kind.isPdf) {
    return (
      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 border border-border dark:border-border-dark bg-white flex items-center justify-center">
        <Document file={file.file_url} loading={<Loader2 size={14} className="animate-spin text-text-muted" />} error={<kind.Icon size={18} className="text-text-muted" />}>
          <Page pageNumber={1} width={44} renderTextLayer={false} renderAnnotationLayer={false} />
        </Document>
      </div>
    )
  }
  return (
    <div className="w-11 h-11 rounded-lg flex-shrink-0 border border-border dark:border-border-dark bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
      <kind.Icon size={18} className="text-primary" />
    </div>
  )
}

function FileCard({
  file, onView, onDelete, onSaveReview, saving,
}: {
  file: OrderFile
  onView: () => void
  onDelete: () => void
  onSaveReview: (status: OrderFileStatus, notes: string) => void
  saving: boolean
}) {
  const kind = getFileKind(file.file_name)
  const [status, setStatus] = useState<OrderFileStatus>(file.status)
  const [notes, setNotes] = useState(file.review_notes ?? '')
  const dirty = status !== file.status || notes !== (file.review_notes ?? '')

  return (
    <div className="rounded-xl border border-border dark:border-border-dark p-3 space-y-3">
      <div className="flex items-start gap-3">
        <FileThumb file={file} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary dark:text-stone-100 break-words leading-snug">{file.file_name}</p>
          <p className="text-[11px] text-text-muted dark:text-stone-500 mt-0.5">
            {kind.label} · {formatFileSize(file.file_size)} · {file.uploaded_by === 'cliente' ? 'Enviado pelo cliente' : 'Enviado pela equipe'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-colors">
          <Eye size={13} /> Visualizar
        </button>
        <a href={getDownloadUrl(file.file_url, file.file_name)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-colors">
          <Download size={13} /> Baixar
        </a>
        <button type="button" onClick={onDelete} title="Excluir"
          className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-light dark:hover:bg-error/10 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="pt-2 border-t border-border dark:border-border-dark space-y-2">
        <p className="text-[11px] font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wide">Status da conferência</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setStatus(opt)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                status === opt
                  ? 'bg-primary text-white border-primary'
                  : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/40'
              )}
            >
              {FILE_STATUS_LABELS[opt]}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          className="input resize-none text-xs"
          placeholder="Observação da conferência..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        {dirty && (
          <button type="button" disabled={saving} onClick={() => onSaveReview(status, notes)}
            className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-50">
            {saving && <Loader2 size={12} className="animate-spin" />} Salvar
          </button>
        )}
      </div>
    </div>
  )
}

export function OrderFilesSection({ orderId, companyId, customerName, customerPhone, customerEmail }: Props) {
  const supabase = createClient()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [viewingFile, setViewingFile] = useState<OrderFile | null>(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const filesKey = ['order-files', orderId]
  const eventsKey = ['order-art-events', orderId]
  const artStatusKey = ['order-art-status', orderId]

  const { data: files, isLoading } = useQuery<OrderFile[]>({
    queryKey: filesKey,
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('order_files') as any)
        .select('*').eq('order_id', orderId).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: events } = useQuery<OrderArtEvent[]>({
    queryKey: eventsKey,
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('order_art_events') as any)
        .select('*').eq('order_id', orderId).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: artStatus } = useQuery<ArtStatus>({
    queryKey: artStatusKey,
    enabled: !!orderId,
    queryFn: async () => {
      const { data } = await (supabase.from('orders') as any).select('art_status').eq('id', orderId).single()
      return (data?.art_status ?? 'nao_enviada') as ArtStatus
    },
  })

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: filesKey })
    qc.invalidateQueries({ queryKey: eventsKey })
    qc.invalidateQueries({ queryKey: artStatusKey })
    qc.invalidateQueries({ queryKey: ['orders'] })
  }

  const uploadMutation = useMutation({
    mutationFn: async (fileList: File[]) => {
      for (const file of fileList) {
        const body = new FormData()
        body.append('file', file)
        body.append('orderId', orderId)
        const res = await fetch('/api/pedidos/upload-arquivo', { method: 'POST', body })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar arquivo')
      }
      // Primeiro arquivo enviado pela equipe move a arte de "não enviada" pra "recebida"
      if ((artStatus ?? 'nao_enviada') === 'nao_enviada') {
        await (supabase.from('orders') as any).update({ art_status: 'recebida' }).eq('id', orderId)
      }
    },
    onSuccess: () => { invalidateAll(); setUploadError(null) },
    onError: (err: Error) => setUploadError(err.message),
  })

  const saveReviewMutation = useMutation({
    mutationFn: async ({ id, status, review_notes }: { id: string; status: OrderFileStatus; review_notes: string }) => {
      const { error } = await (supabase.from('order_files') as any)
        .update({
          status, review_notes: review_notes || null,
          approved_at: status === 'aprovado' ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error

      if (status === 'aprovado') {
        await (supabase.from('order_art_events') as any).insert([{
          order_id: orderId, company_id: companyId,
          event_type: 'arte_conferida', description: 'Arquivo aprovado na conferência.',
        }])
      }
    },
    onSuccess: invalidateAll,
  })

  const deleteMutation = useMutation({
    mutationFn: async (file: OrderFile) => {
      await supabase.storage.from('order-files').remove([file.file_path])
      const { error } = await (supabase.from('order_files') as any).delete().eq('id', file.id)
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const approveArtMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from('orders') as any).update({ art_status: 'aprovada' }).eq('id', orderId)
      if (error) throw error
      await (supabase.from('order_art_events') as any).insert([{
        order_id: orderId, company_id: companyId, event_type: 'arte_aprovada', description: 'Arte aprovada.',
      }])
    },
    onSuccess: invalidateAll,
  })

  const requestNewArtMutation = useMutation({
    mutationFn: async (sentVia: ('whatsapp' | 'email')[]) => {
      const { error } = await (supabase.from('orders') as any).update({ art_status: 'aguardando_novo_arquivo' }).eq('id', orderId)
      if (error) throw error
      const via = sentVia.length > 0 ? ` (via ${sentVia.join(' e ')})` : ''
      await (supabase.from('order_art_events') as any).insert([{
        order_id: orderId, company_id: companyId,
        event_type: 'nova_versao_solicitada', description: `Solicitada nova versão da arte${via}.`,
      }])
    },
    onSuccess: () => { invalidateAll(); setShowRequestModal(false) },
  })

  function handleFilesPicked(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploadError(null)
    uploadMutation.mutate(Array.from(fileList))
  }

  const list = files ?? []
  const status = artStatus ?? 'nao_enviada'

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
        <FolderOpen size={12} /> Arquivos do Cliente
      </h3>

      <div className="rounded-xl border border-border dark:border-border-dark p-3.5 space-y-3">
        {/* Status da arte + ações */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={clsx('px-2.5 py-1 rounded-full text-[11px] font-semibold', ART_STATUS_COLORS[status])}>
            Arte: {ART_STATUS_LABELS[status]}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowRequestModal(true)}
              className="btn-secondary text-xs py-1.5 px-3">
              Solicitar nova arte
            </button>
            <button
              type="button"
              disabled={status === 'aprovada' || status === 'nao_enviada' || approveArtMutation.isPending}
              onClick={() => approveArtMutation.mutate()}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
            >
              {approveArtMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Aprovar arte
            </button>
          </div>
        </div>

        {/* Lista de arquivos */}
        {isLoading ? (
          <p className="text-xs text-text-muted py-4 text-center">Carregando arquivos...</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-text-muted dark:text-stone-500 text-center py-3">Nenhum arquivo enviado ainda.</p>
        ) : (
          <div className="space-y-2.5">
            {list.map(f => (
              <FileCard
                key={f.id}
                file={f}
                onView={() => setViewingFile(f)}
                onDelete={() => { if (confirm(`Excluir "${f.file_name}"?`)) deleteMutation.mutate(f) }}
                onSaveReview={(st, notes) => saveReviewMutation.mutate({ id: f.id, status: st, review_notes: notes })}
                saving={saveReviewMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* Upload */}
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.ai,.eps,.cdr,.zip,.rar"
            onChange={e => { handleFilesPicked(e.target.files); e.target.value = '' }}
          />
          <button
            type="button"
            disabled={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border dark:border-border-dark text-xs font-medium text-text-muted hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadMutation.isPending ? 'Enviando...' : 'Adicionar arquivo (imagem, PDF, AI, CDR, ZIP, RAR)'}
          </button>
          {uploadError && (
            <p className="flex items-center gap-1 text-[11px] text-error mt-1.5"><AlertCircle size={11} /> {uploadError}</p>
          )}
        </div>

        {/* Histórico */}
        {events && events.length > 0 && (
          <div className="pt-2 border-t border-border dark:border-border-dark">
            <p className="text-[11px] font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <History size={11} /> Histórico
            </p>
            <div className="space-y-2">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 text-xs">
                  <Clock size={12} className="text-text-muted mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-text-muted dark:text-stone-500">
                      {new Date(ev.created_at).toLocaleDateString('pt-BR')} —{' '}
                    </span>
                    <span className="text-text-secondary dark:text-stone-300">{ev.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {viewingFile && <OrderFileViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />}

      {showRequestModal && (
        <RequestNewArtModal
          customerName={customerName}
          customerPhone={customerPhone}
          customerEmail={customerEmail}
          onClose={() => setShowRequestModal(false)}
          onConfirm={async ({ sentVia }) => { await requestNewArtMutation.mutateAsync(sentVia) }}
        />
      )}
    </section>
  )
}
