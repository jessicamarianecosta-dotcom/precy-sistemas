'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Document, Page } from 'react-pdf'
import '@/lib/utils/pdfWorker'
import {
  FolderOpen, Eye, Download, Trash2, Loader2, AlertCircle, Upload, CheckCircle2, History, Clock,
  Link2, ChevronDown, ChevronUp, ExternalLink, MessageCircle, Copy, XCircle, RefreshCw,
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
const STATUS_OPTIONS: OrderFileStatus[] = ['nao_conferido', 'conferido', 'aguardando_cliente', 'aprovado', 'necessita_alteracao']

const ARTWORK_STATUS_LABEL: Record<string, string> = { aguardando_aprovacao: 'Aguardando', aprovada: 'Aprovada', alteracao_solicitada: 'Alteração pedida' }
const ARTWORK_STATUS_COLOR: Record<string, string> = {
  aguardando_aprovacao: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  aprovada: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  alteracao_solicitada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

interface Props {
  orderId: string
  companyId: string
  orderNumber?: string | null
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  items?: { id: string; name: string }[]
}

type Artwork = {
  id: string; itemId: string | null; itemName: string | null; label: string | null
  position: number; status: string; version: number; fileId: string | null; fileName: string | null
}
type LinkData = { id: string; status: string; publicNotes: string | null; deadline: string | null; url: string | null } | null

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
  file, onView, onDelete, onSaveReview, saving, onUseForApproval, alreadyUsed,
}: {
  file: OrderFile
  onView: () => void
  onDelete: () => void
  onSaveReview: (status: OrderFileStatus, notes: string) => void
  saving: boolean
  onUseForApproval?: () => void
  alreadyUsed?: boolean
}) {
  const kind = getFileKind(file.file_name)
  const [status, setStatus] = useState<OrderFileStatus>(file.status)
  const [notes, setNotes] = useState(file.review_notes ?? '')
  const dirty = status !== file.status || notes !== (file.review_notes ?? '')
  const eligible = ART_APPROVAL_ALLOWED_TYPES.includes(file.mime_type ?? '')

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

      {onUseForApproval && (
        eligible ? (
          <button type="button" onClick={onUseForApproval} disabled={alreadyUsed}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-dashed border-violet-300 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20 disabled:opacity-40 disabled:cursor-default">
            <Link2 size={13} /> {alreadyUsed ? 'Já está na aprovação' : 'Usar para aprovação do cliente'}
          </button>
        ) : (
          <p className="text-[10px] text-text-muted text-center">Apenas PNG, JPG, WEBP ou PDF podem ir para aprovação do cliente.</p>
        )
      )}

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

export function OrderFilesSection({ orderId, companyId, orderNumber, customerName, customerPhone, customerEmail, items = [] }: Props) {
  const supabase = createClient()
  const qc = useQueryClient()
  const { toast } = useToast()
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

  /* ───────────────── Aprovação digital (múltiplas artes) ───────────────── */
  const [betaAllowed, setBetaAllowed] = useState(false)
  const [linkData, setLinkData] = useState<LinkData>(null)
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loadingArt, setLoadingArt] = useState(false)
  const [pickerForFile, setPickerForFile] = useState<OrderFile | null>(null)
  const [replacingArtwork, setReplacingArtwork] = useState<Artwork | null>(null)
  const [pickerItemId, setPickerItemId] = useState('')
  const [pickerLabel, setPickerLabel] = useState('')
  const [savingArtwork, setSavingArtwork] = useState(false)
  const [showSendConfig, setShowSendConfig] = useState(false)
  const [notes, setNotes] = useState('')
  const [deadline, setDeadline] = useState('')
  const [history, setHistory] = useState<any[] | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [savingLink, setSavingLink] = useState(false)

  async function loadArtApproval() {
    setLoadingArt(true)
    try {
      const r = await fetch(`/api/pedidos/aprovacao-arte?orderId=${encodeURIComponent(orderId)}`)
      const d = await r.json()
      if (r.ok) {
        setLinkData(d.link ?? null)
        setArtworks(d.artworks ?? [])
        setNotes(d.link?.publicNotes ?? '')
        setDeadline(d.link?.deadline ? d.link.deadline.slice(0, 10) : '')
      }
    } finally { setLoadingArt(false) }
  }

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      const allowed = hasDigitalArtApprovalBeta(data.user?.email)
      if (!active) return
      setBetaAllowed(allowed)
      if (allowed) loadArtApproval()
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  function openPickerForFile(file: OrderFile) {
    setPickerForFile(file); setReplacingArtwork(null); setPickerItemId(''); setPickerLabel('')
  }
  function openReplacePicker(artwork: Artwork) {
    setReplacingArtwork(artwork); setPickerForFile(null); setPickerItemId(artwork.itemId ?? ''); setPickerLabel(artwork.label ?? '')
  }

  async function confirmAddArtwork() {
    if (!pickerForFile) return
    setSavingArtwork(true)
    try {
      const r = await fetch('/api/pedidos/aprovacao-arte/artworks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, fileId: pickerForFile.id, itemId: pickerItemId || null, label: pickerLabel || null }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast('success', 'Arte adicionada à aprovação')
      setPickerForFile(null)
      await loadArtApproval()
    } catch (e: any) { toast('error', e.message || 'Não foi possível adicionar a arte') }
    finally { setSavingArtwork(false) }
  }

  async function confirmReplaceArtwork(newFileId?: string) {
    if (!replacingArtwork) return
    setSavingArtwork(true)
    try {
      const body: Record<string, unknown> = { itemId: pickerItemId || null, label: pickerLabel || null }
      if (newFileId) body.fileId = newFileId
      const r = await fetch(`/api/pedidos/aprovacao-arte/artworks/${replacingArtwork.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast('success', newFileId ? 'Nova versão enviada para aprovação' : 'Arte atualizada')
      setReplacingArtwork(null)
      await loadArtApproval()
    } catch (e: any) { toast('error', e.message || 'Não foi possível atualizar a arte') }
    finally { setSavingArtwork(false) }
  }

  async function removeArtwork(artwork: Artwork) {
    if (!window.confirm(`Remover "${artwork.label || 'esta arte'}" da aprovação? O arquivo original continua salvo no pedido.`)) return
    try {
      const r = await fetch(`/api/pedidos/aprovacao-arte/artworks/${artwork.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast('success', 'Arte removida da aprovação')
      await loadArtApproval()
    } catch (e: any) { toast('error', e.message || 'Não foi possível remover') }
  }

  async function saveLinkConfig() {
    setSavingLink(true)
    try {
      const r = await fetch('/api/pedidos/aprovacao-arte', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, publicNotes: notes, deadline: deadline || null }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setLinkData(d.link); setArtworks(d.artworks ?? [])
      toast('success', 'Configuração salva')
    } catch (e: any) { toast('error', e.message || 'Não foi possível salvar') }
    finally { setSavingLink(false) }
  }

  async function loadHistory() {
    if (!linkData) return
    const r = await fetch('/api/pedidos/aprovacao-arte/' + linkData.id)
    const d = await r.json()
    if (r.ok) { setHistory(d.artworks ?? []); setNotifications(d.notifications ?? []) }
  }

  async function cancelLink() {
    if (!linkData) return
    if (!window.confirm('Cancelar esta aprovação? O cliente não poderá mais responder a nenhuma arte deste link.')) return
    const r = await fetch('/api/pedidos/aprovacao-arte/' + linkData.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) })
    const d = await r.json()
    if (!r.ok) { toast('error', d.error); return }
    toast('success', 'Aprovação cancelada')
    await loadArtApproval()
  }

  const usedFileIds = new Set(artworks.map(a => a.fileId).filter(Boolean))
  const list = files ?? []
  const status = artStatus ?? 'nao_enviada'

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
        <FolderOpen size={12} /> Arquivos do Cliente
      </h3>

      <div className="rounded-xl border border-border dark:border-border-dark p-3.5 space-y-3">
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
                onUseForApproval={betaAllowed ? () => openPickerForFile(f) : undefined}
                alreadyUsed={usedFileIds.has(f.id)}
              />
            ))}
          </div>
        )}

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

      {betaAllowed && (
        <div className="rounded-xl border border-border dark:border-border-dark p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
              <Link2 size={12} /> Aprovação digital do cliente
            </h3>
            {loadingArt && <Loader2 size={13} className="animate-spin text-text-muted" />}
          </div>

          {artworks.length === 0 ? (
            <p className="text-[11px] text-text-muted">Marque um arquivo acima como &quot;Usar para aprovação do cliente&quot; para começar.</p>
          ) : (
            <div className="space-y-2">
              {artworks.map(a => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border dark:border-border-dark p-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{a.label || `Arte ${String(a.position + 1).padStart(2, '0')}`}</p>
                    <p className="text-[10px] text-text-muted truncate">{a.itemName ?? 'Arte geral do pedido'} · v{a.version}</p>
                  </div>
                  <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0', ARTWORK_STATUS_COLOR[a.status])}>{ARTWORK_STATUS_LABEL[a.status]}</span>
                  <button type="button" title="Substituir arquivo / editar" onClick={() => openReplacePicker(a)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 flex-shrink-0">
                    <RefreshCw size={13} />
                  </button>
                  <button type="button" title="Remover da aprovação" onClick={() => removeArtwork(a)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light dark:hover:bg-error/10 flex-shrink-0">
                    <XCircle size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {artworks.length > 0 && (
            <div className="pt-2 border-t border-border dark:border-border-dark">
              <button type="button" onClick={() => setShowSendConfig(v => !v)} className="flex w-full items-center justify-between text-xs font-semibold text-primary">
                {linkData?.url ? 'Configurar e enviar aprovação' : 'Gerar link para aprovação'}
                {showSendConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showSendConfig && (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-[10px] text-text-muted">Observação visível ao cliente
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={2000} className="input mt-1 text-xs" placeholder="Informações para a conferência..." />
                    </label>
                    <label className="text-[10px] text-text-muted">Prazo de resposta
                      <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="input mt-1 text-xs" />
                    </label>
                  </div>
                  <button type="button" disabled={savingLink} onClick={saveLinkConfig} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50">
                    {savingLink ? 'Salvando...' : linkData?.url ? 'Salvar observação e prazo' : 'Gerar link de aprovação'}
                  </button>

                  {linkData?.url && (
                    <>
                      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface dark:bg-white/5 p-2">
                        <a href={linkData.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-primary underline break-all flex-1 min-w-0">
                          <ExternalLink size={11} className="flex-shrink-0" /> <span className="truncate">{linkData.url}</span>
                        </a>
                        <button type="button" onClick={() => navigator.clipboard.writeText(linkData.url!).then(() => toast('success', 'Link copiado'))} className="flex items-center gap-1 text-[11px] font-medium text-primary flex-shrink-0">
                          <Copy size={11} /> Copiar
                        </button>
                        {customerPhone && (
                          <button type="button" onClick={() => {
                            const phone = normalizePhoneToWhatsapp(customerPhone)
                            if (!phone) return
                            const msg = `Olá, ${customerName || 'tudo bem'}! Suas artes estão prontas para conferência.\n\nAcesse o link abaixo para visualizar cada arte e realizar a aprovação individualmente.\n\n${linkData.url}${deadline ? `\n\nPrazo para resposta: ${new Date(deadline).toLocaleDateString('pt-BR')}` : ''}\n\nQualquer dúvida, estamos à disposição!`
                            openWhatsappConversation(phone, msg)
                          }} className="flex items-center gap-1 text-[11px] font-medium text-primary flex-shrink-0">
                            <MessageCircle size={11} /> WhatsApp
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px]">
                        <button type="button" onClick={loadHistory} className="font-medium text-primary">Ver histórico</button>
                        <button type="button" onClick={cancelLink} disabled={linkData.status === 'aprovada' || linkData.status === 'cancelada'} className="font-medium text-error disabled:opacity-40">Cancelar aprovação</button>
                      </div>
                    </>
                  )}

                  {notifications.length > 0 && (
                    <div className="space-y-1 border-t border-border dark:border-border-dark pt-2">
                      {notifications.map((n: any) => (
                        <div key={n.id} className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-2 text-[10px]">
                          <b>{n.title}</b><p>{n.message}</p><span className="text-stone-500">{new Date(n.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {history && (
                    <div className="space-y-2 border-t border-border dark:border-border-dark pt-2">
                      {history.map((h: any) => (
                        <div key={h.id} className="rounded-md bg-surface dark:bg-white/5 p-2 text-[10px]">
                          <b>{h.label || h.itemName || 'Arte'}</b> · {ARTWORK_STATUS_LABEL[h.status] ?? h.status}
                          {h.history?.map((v: any) => (
                            <p key={v.id} className="mt-1">v{v.version_number} · {v.status} · {new Date(v.created_at).toLocaleDateString('pt-BR')}
                              {v.response && <> — {v.response.customer_name || 'Cliente'}: {v.response.response === 'aprovada' ? 'Aprovou' : 'Solicitou alteração'}{v.response.customer_note ? ` — ${v.response.customer_note}` : ''}</>}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

      {(pickerForFile || replacingArtwork) && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" onClick={() => { setPickerForFile(null); setReplacingArtwork(null) }}>
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-surface-dark p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold text-sm">{replacingArtwork ? 'Atualizar arte' : 'Adicionar arte para aprovação'}</h4>
            {pickerForFile && <p className="text-xs text-text-muted truncate">{pickerForFile.file_name}</p>}
            {replacingArtwork && (
              <div>
                <p className="text-xs text-text-muted mb-1.5">Substituir arquivo (opcional) — escolha outro já enviado:</p>
                <select className="input text-xs" onChange={e => e.target.value && confirmReplaceArtwork(e.target.value)} defaultValue="">
                  <option value="" disabled>Selecionar arquivo...</option>
                  {list.filter(f => ART_APPROVAL_ALLOWED_TYPES.includes(f.mime_type ?? '')).map(f => (
                    <option key={f.id} value={f.id}>{f.file_name}</option>
                  ))}
                </select>
              </div>
            )}
            <label className="block text-xs text-text-muted">Item do pedido
              <select value={pickerItemId} onChange={e => setPickerItemId(e.target.value)} className="input mt-1 text-xs">
                <option value="">Arte geral do pedido</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-text-muted">Identificação (opcional)
              <input value={pickerLabel} onChange={e => setPickerLabel(e.target.value)} placeholder="Ex.: Frente do cartão" className="input mt-1 text-xs" maxLength={120} />
            </label>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setPickerForFile(null); setReplacingArtwork(null) }} className="btn-secondary text-xs flex-1 py-2">Cancelar</button>
              <button type="button" disabled={savingArtwork} onClick={() => replacingArtwork ? confirmReplaceArtwork() : confirmAddArtwork()} className="btn-primary text-xs flex-1 py-2 disabled:opacity-50">
                {savingArtwork ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
