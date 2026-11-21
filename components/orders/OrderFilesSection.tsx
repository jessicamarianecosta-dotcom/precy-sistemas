'use client'

import { useEffect, useRef, useState } from 'react'
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
import { useToast } from '@/components/ui/Toaster'
import { hasDigitalArtApprovalBeta } from '@/lib/orders/digitalArtApproval'
import { normalizePhoneToWhatsapp, openWhatsappConversation } from '@/lib/orders/whatsapp'
import {
  ART_STATUS_LABELS, ART_STATUS_COLORS, FILE_STATUS_LABELS,
  type ArtStatus, type OrderFile, type OrderFileStatus, type OrderArtEvent,
} from './types'

const ART_APPROVAL_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

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
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [viewingFile, setViewingFile] = useState<OrderFile | null>(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [betaAllowed, setBetaAllowed] = useState(false)
  const [approvalLink, setApprovalLink] = useState('')
  const [approvalLinkId, setApprovalLinkId] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [approvalDeadline, setApprovalDeadline] = useState('')
  const [approvalHistory, setApprovalHistory] = useState<any[]>([])
  const [approvalNotifications, setApprovalNotifications] = useState<any[]>([])
  const [approvalStatusDigital, setApprovalStatusDigital] = useState('')
  const [creatingApprovalLink, setCreatingApprovalLink] = useState(false)
  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      const allowed = hasDigitalArtApprovalBeta(data.user?.email)
      if (!active) return
      setBetaAllowed(allowed)
      if (allowed) {
        const r = await fetch(`/api/pedidos/aprovacao-arte?orderId=${encodeURIComponent(orderId)}`)
        const d = await r.json()
        if (active && r.ok && d.link) {
          setApprovalLink(d.link.url); setApprovalLinkId(d.link.id); setApprovalStatusDigital(d.link.status)
        }
      }
    })
    return () => { active = false }
  }, [orderId])

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
  const approvalEligibleFiles = list.filter(f => ART_APPROVAL_ALLOWED_TYPES.includes(f.mime_type ?? ''))

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

        {betaAllowed && (
          <div className="rounded-lg border border-violet-200 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">Aprovação digital do cliente</p>
                <p className="text-[10px] text-text-muted">Link público para conferir e responder sem login.</p>
              </div>
              <button
                type="button"
                disabled={creatingApprovalLink || approvalEligibleFiles.length === 0}
                onClick={async () => {
                  setCreatingApprovalLink(true)
                  try {
                    const response = await fetch('/api/pedidos/aprovacao-arte', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderId, fileIds: approvalEligibleFiles.map(f => f.id), publicNotes: approvalNotes, deadline: approvalDeadline || undefined }),
                    })
                    const result = await response.json()
                    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o link')
                    setApprovalLink(result.url); setApprovalLinkId(result.linkId); setApprovalStatusDigital('aguardando_aprovacao')
                    await navigator.clipboard.writeText(result.url)
                    toast('success', 'Link de aprovação criado e copiado')
                  } catch (e: any) { toast('error', e.message || 'Erro ao gerar link') }
                  finally { setCreatingApprovalLink(false) }
                }}
                className="text-[11px] font-semibold rounded-lg bg-violet-700 text-white px-3 py-2 disabled:opacity-50"
              >
                {creatingApprovalLink ? 'Gerando...' : 'Gerar link de aprovação'}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[10px] text-text-muted">Observação visível ao cliente
                <textarea value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} rows={2} maxLength={2000} className="mt-1 w-full rounded-md border border-violet-200 bg-white p-2 text-xs" placeholder="Informações para a conferência..." />
              </label>
              <label className="text-[10px] text-text-muted">Prazo de resposta
                <input type="date" value={approvalDeadline} onChange={e => setApprovalDeadline(e.target.value)} className="mt-1 w-full rounded-md border border-violet-200 bg-white p-2 text-xs" />
              </label>
            </div>
            {approvalLink && (
              <div className="flex items-center gap-2 flex-wrap">
                <a href={approvalLink} target="_blank" rel="noreferrer" className="text-[11px] text-violet-700 underline break-all">{approvalLink}</a>
                <button type="button" onClick={() => navigator.clipboard.writeText(approvalLink).then(() => toast('success', 'Link copiado'))} className="text-[11px] font-medium text-violet-700">Copiar</button>
                {customerPhone && (
                  <button type="button" onClick={() => { const phone = normalizePhoneToWhatsapp(customerPhone); if (phone) openWhatsappConversation(phone, `Olá, ${customerName || 'tudo bem'}! Sua arte está disponível para conferência e aprovação: ${approvalLink}`) }} className="text-[11px] font-medium text-violet-700">Enviar pelo WhatsApp</button>
                )}
              </div>
            )}
            {approvalLinkId && (
              <div className="flex flex-wrap gap-2 border-t border-violet-200 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const r = await fetch('/api/pedidos/aprovacao-arte/' + approvalLinkId)
                    const d = await r.json()
                    if (r.ok) { setApprovalHistory(d.history ?? []); setApprovalNotifications(d.notifications ?? []); setApprovalStatusDigital(d.link.status); if (d.link.publicUrl) setApprovalLink(d.link.publicUrl) }
                  }}
                  className="text-[11px] font-medium text-violet-700"
                >
                  Ver histórico de versões e respostas
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Cancelar este link? O cliente não poderá mais responder.')) return
                    const r = await fetch('/api/pedidos/aprovacao-arte/' + approvalLinkId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) })
                    const d = await r.json()
                    if (!r.ok) { toast('error', d.error); return }
                    setApprovalStatusDigital('cancelada'); toast('success', 'Link cancelado')
                  }}
                  disabled={approvalStatusDigital === 'aprovada' || approvalStatusDigital === 'cancelada'}
                  className="text-[11px] font-medium text-red-600 disabled:opacity-40"
                >
                  Cancelar link
                </button>
              </div>
            )}
            {approvalNotifications.length > 0 && (
              <div className="space-y-1 border-t border-violet-200 pt-2">
                {approvalNotifications.map((n: any) => (
                  <div key={n.id} className="rounded-md bg-amber-50 p-2 text-[10px]">
                    <b>{n.title}</b><p>{n.message}</p><span className="text-stone-500">{new Date(n.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
            {approvalLinkId && approvalStatusDigital !== 'aprovada' && approvalStatusDigital !== 'cancelada' && (
              <button
                type="button"
                onClick={async () => {
                  if (!approvalEligibleFiles.length) { toast('error', 'Envie os arquivos da nova versão primeiro'); return }
                  if (!window.confirm('Enviar os arquivos atuais como uma nova versão para aprovação?')) return
                  const r = await fetch('/api/pedidos/aprovacao-arte/' + approvalLinkId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'new_version', fileIds: approvalEligibleFiles.map(f => f.id), publicNotes: approvalNotes, deadline: approvalDeadline || undefined }) })
                  const d = await r.json()
                  if (!r.ok) { toast('error', d.error); return }
                  setApprovalStatusDigital('aguardando_aprovacao'); setApprovalHistory([]); toast('success', 'Nova versão enviada para aprovação')
                }}
                className="text-[11px] font-semibold text-violet-700"
              >
                Enviar nova versão
              </button>
            )}
            {approvalHistory.length > 0 && (
              <div className="space-y-2 border-t border-violet-200 pt-2">
                {approvalHistory.map((v: any) => (
                  <div key={v.id} className="rounded-md bg-white p-2 text-[10px]">
                    <b>Versão {v.version_number}</b> · {v.status} · {new Date(v.created_at).toLocaleString('pt-BR')}
                    {v.response && <p className="mt-1">{v.response.customer_name || 'Cliente'}: {v.response.response === 'aprovada' ? 'Aprovou' : 'Solicitou alteração'}{v.response.customer_note ? ` — ${v.response.customer_note}` : ''}</p>}
                    {v.response?.attachments?.length > 0 && (
                      <p className="mt-1">Anexos: {v.response.attachments.map((a: any) => <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="mr-2 text-violet-700 underline">{a.name}</a>)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {approvalEligibleFiles.length === 0 && (
              <p className="text-[10px] text-amber-700">Envie um arquivo PNG, JPG, WEBP ou PDF para habilitar o link.</p>
            )}
          </div>
        )}

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
