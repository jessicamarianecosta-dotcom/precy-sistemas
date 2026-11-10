'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import {
  CheckCircle2, XCircle, Clock, Copy, Check, Package,
  Truck, CreditCard, AlertTriangle, Building2, X as CloseIcon,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { pixTypeLabel } from '@/lib/company/pix'

interface BudgetItemOut {
  id: string
  name: string
  description: string | null
  quantity: number
  unit_price: number
  subtotal: number
  discount: number | null
  variant_label: string | null
  finishings: string[] | null
  technical_notes: string | null
  image: string | null
}

interface BudgetOut {
  id: string
  budget_number: string
  status: string
  subtotal: number
  discount: number
  total: number
  notes: string | null
  valid_until: string | null
  created_at: string
  payment_method: string | null
  pay_condition: string | null
  installments: number | null
  signal_amount: number | null
  delivery_type: string | null
  delivery_fee: number | null
  delivery_addr: string | null
  delivery_days: string | null
  production_days: string | null
  prazo_type: string | null
  prazo_dias: number | null
  prazo_due_date: string | null
  payment_status: string
  approved_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  converted: boolean
  is_expired: boolean
  customer_name: string | null
}

interface CompanyOut {
  name: string
  email: string | null
  phone: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string
}

interface PixOut {
  key: string
  type: string | null
  label: string | null
  amount: number
  payload: string
  qrCodeBase64: string
}

interface ApiResponse {
  budget: BudgetOut
  company: CompanyOut
  items: BudgetItemOut[]
  pix: PixOut | null
}

const STATUS_LABELS: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  sent: { label: 'Aguardando sua análise', icon: Clock, className: 'text-amber-600 dark:text-amber-400' },
  viewed: { label: 'Aguardando sua análise', icon: Clock, className: 'text-amber-600 dark:text-amber-400' },
  approved: { label: 'Aprovado', icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Reprovado', icon: XCircle, className: 'text-red-600 dark:text-red-400' },
  converted: { label: 'Aprovado', icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch { /* clipboard indisponível — ignora */ }
      }}
      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 dark:bg-white dark:text-stone-900 transition-colors w-full sm:w-auto"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? 'Copiado!' : label}
    </button>
  )
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button className="absolute top-4 right-4 text-white" onClick={onClose} aria-label="Fechar">
        <CloseIcon size={28} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
    </div>
  )
}

export default function OrcamentoPublicoPage() {
  const { token } = useParams<{ token: string }>()
  const qc = useQueryClient()
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['loja-orcamento-publico', token],
    queryFn: async () => {
      const res = await fetch(`/api/loja/orcamento/${token}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Orçamento não encontrado')
      return json
    },
    retry: false,
  })

  async function submitDecision(action: 'approve' | 'reject') {
    setSubmitting(true)
    try {
      const path = action === 'approve' ? 'aprovar' : 'reprovar'
      const res = await fetch(`/api/loja/orcamento/${token}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ reason: rejectReason }) : undefined,
      })
      const json = await res.json()
      if (!res.ok) {
        setResultMessage({ type: 'error', text: json.error ?? 'Não foi possível concluir a ação.' })
      } else if (action === 'approve') {
        setResultMessage(json.alreadyApproved
          ? { type: 'success', text: 'Este orçamento já havia sido aprovado.' }
          : { type: 'success', text: 'Orçamento aprovado! Em breve entraremos em contato.' })
      } else {
        setResultMessage({ type: 'success', text: 'Orçamento reprovado. Obrigado pelo retorno.' })
      }
      qc.invalidateQueries({ queryKey: ['loja-orcamento-publico', token] })
    } catch {
      setResultMessage({ type: 'error', text: 'Erro de conexão. Tente novamente.' })
    } finally {
      setSubmitting(false)
      setConfirmAction(null)
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-stone-500">Carregando orçamento…</div>
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertTriangle size={32} className="text-stone-400" />
        <p className="text-base font-medium text-stone-700 dark:text-stone-300">Orçamento não encontrado</p>
        <p className="text-sm text-stone-500">Verifique se o link está completo e correto.</p>
      </div>
    )
  }

  const { budget: b, company, items, pix } = data
  const statusInfo = STATUS_LABELS[b.status] ?? STATUS_LABELS.sent
  const StatusIcon = statusInfo.icon
  const finalized = b.status === 'approved' || b.status === 'converted' || b.status === 'rejected'
  const canDecide = !finalized && !resultMessage

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <header
        className="py-6 px-4 text-white"
        style={{ backgroundColor: company.primary_color || '#8B6C4F' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {company.logo_url ? (
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
              <Image src={company.logo_url} alt={company.name} fill sizes="48px" className="object-contain" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-bold truncate">{company.name}</h1>
            <p className="text-xs opacity-80 truncate">
              {[company.phone, company.email].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Cabeçalho do orçamento */}
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-bold">Orçamento {b.budget_number}</h2>
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusInfo.className}`}>
              <StatusIcon size={16} /> {statusInfo.label}
            </span>
          </div>
          <div className="text-sm text-stone-500 dark:text-stone-400 space-y-0.5">
            {b.customer_name && <p>Cliente: <b className="text-stone-700 dark:text-stone-200">{b.customer_name}</b></p>}
            <p>Emitido em {new Date(b.created_at).toLocaleDateString('pt-BR')}</p>
            {b.valid_until && (
              <p className={b.is_expired ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                Válido até {new Date(b.valid_until).toLocaleDateString('pt-BR')}
                {b.is_expired ? ' — vencido' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Itens */}
        <div className="bg-white dark:bg-stone-900 rounded-xl shadow-sm divide-y divide-stone-100 dark:divide-stone-800">
          {items.map(item => (
            <div key={item.id} className="flex gap-3 p-4">
              {item.image && (
                <button
                  type="button"
                  onClick={() => setLightboxSrc(item.image)}
                  className="relative w-16 h-16 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 flex-shrink-0"
                >
                  <Image src={item.image} alt={item.name} fill sizes="64px" className="object-contain" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.name}</p>
                {item.variant_label && <p className="text-xs text-stone-500">{item.variant_label}</p>}
                {item.description && <p className="text-xs text-stone-500 mt-0.5">{item.description}</p>}
                <p className="text-xs text-stone-500 mt-1">
                  {item.quantity}x {formatCurrency(item.unit_price)}
                </p>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap">{formatCurrency(item.subtotal)}</p>
            </div>
          ))}
        </div>

        {/* Totais e condições */}
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm space-y-1.5 text-sm">
          <div className="flex justify-between text-stone-500 dark:text-stone-400">
            <span>Subtotal</span><span>{formatCurrency(b.subtotal)}</span>
          </div>
          {b.discount > 0 && (
            <div className="flex justify-between text-stone-500 dark:text-stone-400">
              <span>Desconto</span><span>- {formatCurrency(b.discount)}</span>
            </div>
          )}
          {!!b.delivery_fee && (
            <div className="flex justify-between text-stone-500 dark:text-stone-400">
              <span>Frete</span><span>{formatCurrency(b.delivery_fee)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-1.5 border-t border-stone-100 dark:border-stone-800">
            <span>Total</span><span>{formatCurrency(b.total)}</span>
          </div>

          <div className="pt-2 space-y-1 text-xs text-stone-500 dark:text-stone-400">
            {b.payment_method && (
              <p className="flex items-center gap-1.5"><CreditCard size={13} /> Pagamento: {b.payment_method}
                {b.pay_condition === 'entrada' && b.signal_amount ? ` — entrada de ${formatCurrency(b.signal_amount)}` : ''}
                {b.pay_condition === 'parcelado' && b.installments ? ` em ${b.installments}x` : ''}
              </p>
            )}
            {b.delivery_type && (
              <p className="flex items-center gap-1.5"><Truck size={13} /> Entrega: {b.delivery_type}
                {b.delivery_days ? ` · ${b.delivery_days}` : ''}
              </p>
            )}
            {b.production_days && (
              <p className="flex items-center gap-1.5"><Package size={13} /> Produção: {b.production_days}</p>
            )}
          </div>

          {b.notes && (
            <div className="pt-2 mt-2 border-t border-stone-100 dark:border-stone-800">
              <p className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-0.5">Observações</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 whitespace-pre-wrap">{b.notes}</p>
            </div>
          )}
        </div>

        {/* PIX */}
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-sm mb-3">Pagamento via Pix</h3>
          {pix ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-2xl font-bold" style={{ color: company.primary_color }}>
                {formatCurrency(pix.amount)}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pix.qrCodeBase64} alt="QR Code Pix" className="w-48 h-48 rounded-lg border border-stone-200 dark:border-stone-700" />
              <div className="text-xs text-stone-500 dark:text-stone-400 space-y-0.5">
                {pix.label && <p>Beneficiário: <b className="text-stone-700 dark:text-stone-200">{pix.label}</b></p>}
                <p>Chave {pixTypeLabel(pix.type)}: <b className="text-stone-700 dark:text-stone-200 break-all">{pix.key}</b></p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <CopyButton value={pix.key} label="Copiar chave Pix" />
                <CopyButton value={pix.payload} label="Copiar código Pix" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Esta empresa ainda não configurou uma chave Pix para pagamento online. Entre em contato para combinar a forma de pagamento.</p>
          )}
        </div>

        {/* Mensagem de resultado */}
        {resultMessage && (
          <div className={`rounded-xl p-4 text-sm font-medium ${resultMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
            {resultMessage.text}
          </div>
        )}

        {/* Já decidido anteriormente */}
        {!resultMessage && b.status === 'approved' && b.approved_at && (
          <div className="rounded-xl p-4 text-sm font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Este orçamento foi aprovado em {new Date(b.approved_at).toLocaleString('pt-BR')}.
          </div>
        )}
        {!resultMessage && b.status === 'rejected' && b.rejected_at && (
          <div className="rounded-xl p-4 text-sm font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
            Este orçamento foi reprovado em {new Date(b.rejected_at).toLocaleString('pt-BR')}.
          </div>
        )}

        {/* Ações */}
        {canDecide && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-6">
            <button
              type="button"
              disabled={b.is_expired}
              onClick={() => setConfirmAction('approve')}
              className="py-3.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {b.is_expired ? 'Orçamento vencido' : 'Aprovar orçamento'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('reject')}
              className="py-3.5 rounded-xl font-semibold text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              Reprovar orçamento
            </button>
            {b.is_expired && (
              <p className="sm:col-span-2 text-xs text-center text-stone-500">
                Orçamento vencido — entre em contato com a empresa para revalidação.
              </p>
            )}
          </div>
        )}
      </main>

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-xl p-5 w-full sm:max-w-sm space-y-4">
            <h3 className="font-bold text-base">
              {confirmAction === 'approve' ? 'Confirmar aprovação do orçamento?' : 'Confirmar reprovação do orçamento?'}
            </h3>
            {confirmAction === 'reject' && (
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Motivo (opcional)"
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border border-stone-200 dark:border-stone-700 bg-transparent p-2.5 text-sm"
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg font-medium text-sm bg-stone-100 dark:bg-stone-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => submitDecision(confirmAction)}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-lg font-medium text-sm text-white disabled:opacity-50 ${confirmAction === 'approve' ? 'bg-emerald-600' : 'bg-red-600'}`}
              >
                {submitting ? 'Enviando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
