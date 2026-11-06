'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  Palette, FileCheck2, Upload, Loader2, ExternalLink, MessageCircle, CheckCircle2,
  Info, AlertTriangle, PlayCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { syncOrderArtStatusFromItems } from '@/lib/orders/artApproval'
import { buildArtProposalsSentMessage, buildArtApprovedMessage, normalizePhoneToWhatsapp, openWhatsappConversation } from '@/lib/orders/whatsapp'
import {
  ART_APPROVAL_STATUS_LABELS, ART_APPROVAL_STATUS_COLORS,
  type OrderFile, type ArtApprovalStatus,
} from './types'

interface OrderItemArtPanelProps {
  orderId: string
  orderNumber: string | null
  companyId: string
  itemId: string
  itemName: string
  artOrigin: 'own' | 'lumilife' | null | undefined
  artBrief: { text?: string; colors?: string; style?: string; description?: string } | null | undefined
  approvalStatus: ArtApprovalStatus
  freeRevisionsUsed: number
  freeRevisionsLimit: number
  customerName?: string | null
  customerPhone?: string | null
  onChanged: () => void
}

/**
 * Painel de arte de UM item do pedido (Catálogo Online) — origem, briefing,
 * arquivos do cliente/referências/propostas da equipe, e as ações
 * administrativas do fluxo de aprovação (iniciar análise, enviar
 * propostas, registrar alteração, aprovar). Nunca mistura arquivos de
 * itens diferentes: tudo filtrado por order_item_id.
 */
export function OrderItemArtPanel({
  orderId, orderNumber, companyId, itemId, itemName, artOrigin, artBrief,
  approvalStatus, freeRevisionsUsed, freeRevisionsLimit,
  customerName, customerPhone, onChanged,
}: OrderItemArtPanelProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const proposalInputRef = useRef<HTMLInputElement>(null)
  const [uploadingProposal, setUploadingProposal] = useState<number | null>(null)
  const [extraPrice, setExtraPrice] = useState('')

  const { data: files } = useQuery<OrderFile[]>({
    queryKey: ['order-item-files', itemId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('order_files') as any)
        .select('*')
        .eq('order_item_id', itemId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!artOrigin,
  })

  const clientFiles = (files ?? []).filter(f => f.file_role === 'cliente_arte')
  const referenceFiles = (files ?? []).filter(f => f.file_role === 'referencia')
  const proposalFiles = (files ?? []).filter(f => f.file_role === 'proposta')
  const finalFiles = (files ?? []).filter(f => f.file_role === 'versao_final')

  async function updateApproval(
    status: 'in_review' | 'proposals_sent' | 'revision_requested' | 'awaiting_extra_authorization' | 'approved',
    extra: Record<string, unknown> = {},
    eventDescription?: string,
  ) {
    const { error } = await (supabase.from('order_items') as any)
      .update({ art_approval_status: status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', itemId)
    if (error) throw new Error(error.message)
    if (eventDescription) {
      await (supabase.from('order_art_events') as any).insert({
        order_id: orderId, company_id: companyId, event_type: `arte_item_${status}`, description: eventDescription,
      })
    }
    await syncOrderArtStatusFromItems(supabase, orderId, status)
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order-item-files', itemId] })
    queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
    onChanged()
  }

  const startReviewMutation = useMutation({
    mutationFn: () => updateApproval('in_review', {}, `Equipe iniciou a análise da arte de "${itemName}".`),
    onSuccess: () => { invalidate(); toast('success', 'Análise iniciada') },
    onError: (e: any) => toast('error', e.message),
  })

  async function uploadProposalFile(file: File, proposalNumber: number) {
    setUploadingProposal(proposalNumber)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('orderId', orderId)
      body.append('orderItemId', itemId)
      body.append('fileRole', 'proposta')
      body.append('proposalNumber', String(proposalNumber))
      const res = await fetch('/api/pedidos/upload-arquivo', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar proposta')
      invalidate()
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setUploadingProposal(null)
    }
  }

  const sendProposalsMutation = useMutation({
    mutationFn: () => updateApproval('proposals_sent', {}, `Propostas de arte enviadas ao cliente para "${itemName}" (${proposalFiles.length} de 3).`),
    onSuccess: () => {
      invalidate()
      toast('success', 'Propostas marcadas como enviadas')
      const phone = normalizePhoneToWhatsapp(customerPhone)
      if (phone && customerName) {
        openWhatsappConversation(phone, buildArtProposalsSentMessage({ customerName, orderNumber, itemName }))
      }
    },
    onError: (e: any) => toast('error', e.message),
  })

  const revisionMutation = useMutation({
    mutationFn: async () => {
      if (freeRevisionsUsed < freeRevisionsLimit) {
        await updateApproval(
          'revision_requested',
          { art_free_revisions_used: freeRevisionsUsed + 1 },
          `Alteração solicitada em "${itemName}" (uso ${freeRevisionsUsed + 1} de ${freeRevisionsLimit} gratuitas na proposta escolhida).`
        )
      } else {
        const price = Number(extraPrice.replace(',', '.'))
        if (!price || price <= 0) throw new Error('Informe o valor do orçamento da alteração extra')
        await updateApproval(
          'awaiting_extra_authorization',
          { art_extra_change_price: price, art_extra_change_authorized: false },
          `Limite de alterações gratuitas atingido em "${itemName}" — orçamento de alteração extra enviado ao cliente.`
        )
      }
    },
    onSuccess: () => { invalidate(); toast('success', 'Registrado'); setExtraPrice('') },
    onError: (e: any) => toast('error', e.message),
  })

  const authorizeExtraMutation = useMutation({
    mutationFn: () => updateApproval('revision_requested', { art_extra_change_authorized: true }, `Cliente autorizou a alteração extra em "${itemName}".`),
    onSuccess: () => { invalidate(); toast('success', 'Alteração extra autorizada') },
    onError: (e: any) => toast('error', e.message),
  })

  const approveMutation = useMutation({
    mutationFn: () => updateApproval('approved', {}, `Arte de "${itemName}" aprovada.`),
    onSuccess: () => {
      invalidate()
      toast('success', 'Arte aprovada!')
      const phone = normalizePhoneToWhatsapp(customerPhone)
      if (phone && customerName) {
        openWhatsappConversation(phone, buildArtApprovedMessage({ customerName, orderNumber, itemName }))
      }
    },
    onError: (e: any) => toast('error', e.message),
  })

  if (!artOrigin) return null

  const statusLabel = ART_APPROVAL_STATUS_LABELS[approvalStatus] ?? approvalStatus
  const statusColor = ART_APPROVAL_STATUS_COLORS[approvalStatus] ?? ''

  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-border dark:border-border-dark space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary dark:text-stone-100">
          {artOrigin === 'own' ? <FileCheck2 size={13} /> : <Palette size={13} />}
          {artOrigin === 'own' ? 'Cliente enviou arte própria' : 'Criação de arte pela equipe'}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {artOrigin === 'lumilife' && artBrief && (
        <div className="text-[11px] text-text-muted space-y-0.5 rounded-lg bg-surface dark:bg-white/5 p-2">
          {artBrief.text && <p><b>Texto/nome:</b> {artBrief.text}</p>}
          {artBrief.colors && <p><b>Cores:</b> {artBrief.colors}</p>}
          {artBrief.style && <p><b>Estilo:</b> {artBrief.style}</p>}
          {artBrief.description && <p><b>Descrição:</b> {artBrief.description}</p>}
        </div>
      )}

      {clientFiles.length > 0 && (
        <FileList label="Arquivos do cliente" files={clientFiles} />
      )}
      {referenceFiles.length > 0 && (
        <FileList label="Referências enviadas" files={referenceFiles} />
      )}
      {proposalFiles.length > 0 && (
        <FileList label={`Propostas enviadas (${proposalFiles.length}/3)`} files={proposalFiles} />
      )}
      {finalFiles.length > 0 && (
        <FileList label="Versão final" files={finalFiles} />
      )}

      <div className="flex flex-wrap gap-1.5">
        {approvalStatus === 'pending' && (
          <ActionButton icon={PlayCircle} label="Iniciar análise" onClick={() => startReviewMutation.mutate()} loading={startReviewMutation.isPending} />
        )}

        {artOrigin === 'lumilife' && ['in_review', 'proposals_sent'].includes(approvalStatus) && (
          <>
            {[1, 2, 3].map(n => (
              <label key={n} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border dark:border-border-dark cursor-pointer flex items-center gap-1 hover:bg-surface dark:hover:bg-white/5">
                {uploadingProposal === n ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Proposta {n}
                <input
                  ref={proposalInputRef}
                  type="file"
                  className="hidden"
                  disabled={uploadingProposal !== null}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadProposalFile(f, n); e.target.value = '' }}
                />
              </label>
            ))}
            {proposalFiles.length > 0 && approvalStatus !== 'proposals_sent' && (
              <ActionButton icon={MessageCircle} label="Enviar propostas ao cliente" onClick={() => sendProposalsMutation.mutate()} loading={sendProposalsMutation.isPending} />
            )}
          </>
        )}

        {['proposals_sent', 'awaiting_choice', 'revision_requested'].includes(approvalStatus) && (
          <>
            <ActionButton
              icon={AlertTriangle}
              label={freeRevisionsUsed < freeRevisionsLimit ? `Registrar alteração (${freeRevisionsUsed}/${freeRevisionsLimit} usadas)` : 'Registrar alteração extra'}
              onClick={() => revisionMutation.mutate()}
              loading={revisionMutation.isPending}
            />
            {freeRevisionsUsed >= freeRevisionsLimit && (
              <input
                className="input text-xs w-32 py-1.5"
                placeholder="Valor extra (R$)"
                value={extraPrice}
                onChange={e => setExtraPrice(e.target.value)}
              />
            )}
            <ActionButton icon={CheckCircle2} label="Marcar arte como aprovada" onClick={() => approveMutation.mutate()} loading={approveMutation.isPending} variant="success" />
          </>
        )}

        {approvalStatus === 'awaiting_extra_authorization' && (
          <ActionButton icon={CheckCircle2} label="Cliente autorizou a alteração extra" onClick={() => authorizeExtraMutation.mutate()} loading={authorizeExtraMutation.isPending} />
        )}

        {approvalStatus === 'approved' && (
          <span className="flex items-center gap-1 text-[11px] text-success font-medium">
            <CheckCircle2 size={13} /> Arte aprovada
          </span>
        )}
      </div>

      {artOrigin === 'lumilife' && (
        <p className="flex items-start gap-1 text-[10px] text-text-muted">
          <Info size={11} className="shrink-0 mt-0.5" />
          3 propostas sem custo + até {freeRevisionsLimit} alterações gratuitas só na proposta escolhida pelo cliente.
        </p>
      )}
    </div>
  )
}

function FileList({ label, files }: { label: string; files: OrderFile[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {files.map(f => (
          <a
            key={f.id}
            href={f.file_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-surface dark:bg-white/5 hover:opacity-80"
          >
            {f.proposal_number ? `#${f.proposal_number} ` : ''}{f.file_name}
            <ExternalLink size={10} />
          </a>
        ))}
      </div>
    </div>
  )
}

function ActionButton({
  icon: Icon, label, onClick, loading, variant = 'default',
}: { icon: typeof PlayCircle; label: string; onClick: () => void; loading?: boolean; variant?: 'default' | 'success' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
        variant === 'success'
          ? 'border-success text-success hover:bg-success-light dark:hover:bg-success/10'
          : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:bg-surface dark:hover:bg-white/5'
      }`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
      {label}
    </button>
  )
}
