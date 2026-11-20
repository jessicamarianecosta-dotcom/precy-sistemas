'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils/format'
import { clsx } from 'clsx'
import {
  ArrowLeft, AlertTriangle, Loader2, CheckCircle2, Send, FileText, Download, RefreshCw,
} from 'lucide-react'

interface AvulsaPreviewData {
  invoice: {
    id: string; status: string; bling_status: string | null; bling_invoice_id: string | null
    access_key: string | null; danfe_url: string | null; xml_url: string | null; error_message: string | null
    natureza_operacao: string | null
  }
  customer: { id: string; name: string } | null
  items: { id: string; name: string | null; quantity: number; unit_price: number; product_ncm: string | null }[]
  numero: string
  total: number
}

/**
 * Revisão/acompanhamento de uma nota fiscal AVULSA (sem pedido vinculado).
 * A criação do rascunho já aconteceu em /notas-fiscais/avulsa/nova — esta
 * tela só consulta status e confirma o envio à SEFAZ, usando exatamente as
 * MESMAS rotas já existentes do fluxo por pedido
 * (/api/notas-fiscais/[id] e /api/notas-fiscais/[id]/enviar), sem
 * nenhuma alteração nelas.
 */
export default function NotaFiscalAvulsaPage() {
  const params = useParams<{ invoiceId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<AvulsaPreviewData>({
    queryKey: ['notas_fiscais_avulsa_preview', params.invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/notas-fiscais/avulsa/${params.invoiceId}`)
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Falha ao carregar a nota')
      return res.json()
    },
  })

  const enviarMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/notas-fiscais/${invoiceId}/enviar`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Falha ao enviar a nota')
      return body.invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas_fiscais_avulsa_preview', params.invoiceId] })
      toast('success', 'Nota enviada para autorização na SEFAZ.')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  const refreshMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/notas-fiscais/${invoiceId}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Falha ao consultar status')
      return body.invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas_fiscais_avulsa_preview', params.invoiceId] })
    },
    onError: (err: Error) => toast('error', err.message),
  })

  if (isLoading || !data) {
    return (
      <div className="p-4 sm:p-6">
        <Header title="Nota Fiscal Avulsa" />
        <p className="text-sm text-text-muted mt-4">Carregando…</p>
      </div>
    )
  }

  const { invoice, customer, items, numero, total } = data
  const canSend = invoice.bling_invoice_id
    && !['enviando', 'processando', 'autorizada', 'rejeitada', 'cancelada'].includes(invoice.status)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <div>
        <button onClick={() => router.push('/notas-fiscais')} className="text-xs text-text-muted flex items-center gap-1 mb-2">
          <ArrowLeft size={13} /> Voltar
        </button>
        <Header title={`Nota Fiscal Avulsa — ${numero}`} subtitle={customer?.name ?? undefined} />
      </div>

      {/* Resumo */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Resumo</h3>
        <div className="text-sm text-text-secondary dark:text-stone-300 space-y-1">
          <p>Destinatário: <span className="font-medium">{customer?.name ?? '—'}</span></p>
          <p>Natureza da operação: <span className="font-medium">{invoice.natureza_operacao ?? '—'}</span></p>
          <p>Total da nota: <span className="font-medium">{formatCurrency(total)}</span></p>
        </div>
        <div className="divide-y divide-border dark:divide-border-dark rounded-xl border border-border dark:border-border-dark overflow-hidden mt-2">
          {items.map(item => (
            <div key={item.id} className="px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-text-secondary dark:text-stone-300">
                {item.quantity}x {item.name ?? 'Item'}
                {!item.product_ncm && <span className="text-amber-600 ml-1">(NCM faltando)</span>}
              </span>
              <span className="text-text-muted">{formatCurrency(item.unit_price)}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-text-muted">
          Nota avulsa — não vinculada a um pedido do Precy+. Origem registrada como &quot;avulsa&quot;.
        </p>
      </div>

      {/* Estado atual / ações — mesmas rotas/regras do fluxo por pedido */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Status</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                Status interno: <StatusBadge status={invoice.status} />
              </p>
              {invoice.bling_status && (
                <p className="text-xs text-text-muted mt-1">Retorno do Bling: {invoice.bling_status}</p>
              )}
              {invoice.error_message && (
                <p className="text-xs text-error mt-1">{invoice.error_message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => refreshMutation.mutate(invoice.id)}
              disabled={refreshMutation.isPending}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {refreshMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Atualizar status
            </button>
          </div>

          {canSend && (
            <div className="border-t border-border dark:border-border-dark pt-3">
              <p className="text-xs text-text-muted mb-2">
                Confira os dados acima antes de confirmar — esta ação envia a nota para autorização real na SEFAZ e não pode ser desfeita pelo Precy+.
              </p>
              <button
                type="button"
                onClick={() => enviarMutation.mutate(invoice.id)}
                disabled={enviarMutation.isPending}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {enviarMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Confirmar e enviar à SEFAZ
              </button>
            </div>
          )}

          {invoice.status === 'autorizada' && (
            <div className="border-t border-border dark:border-border-dark pt-3 flex items-center gap-4">
              <span className="text-sm text-success-dark flex items-center gap-1.5"><CheckCircle2 size={15} /> Autorizada</span>
              {invoice.access_key && (
                <span className="text-xs text-text-muted">Chave: {invoice.access_key}</span>
              )}
              {invoice.danfe_url && (
                <a href={invoice.danfe_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1">
                  <FileText size={12} /> DANFE
                </a>
              )}
              {invoice.xml_url && (
                <a href={invoice.xml_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1">
                  <Download size={12} /> XML
                </a>
              )}
            </div>
          )}

          {!invoice.bling_invoice_id && (
            <div className="border-t border-border dark:border-border-dark pt-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Esta nota ainda não foi criada no Bling (erro na criação — veja a mensagem acima). Refaça a emissão a partir de uma nova nota avulsa.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    rascunho: 'text-stone-600', enviando: 'text-blue-600', processando: 'text-amber-600',
    autorizada: 'text-green-600', rejeitada: 'text-red-600', cancelada: 'text-stone-400', erro: 'text-red-600',
  }
  return <span className={clsx('font-semibold', cls[status] ?? '')}>{status}</span>
}
