'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils/format'
import { clsx } from 'clsx'
import { useState } from 'react'
import {
  ArrowLeft, AlertTriangle, Loader2, CheckCircle2, Send, FileText, Download, RefreshCw, Pencil,
} from 'lucide-react'
import { CompletarDestinatarioModal, type DestinatarioFiscalEditavel } from '@/components/notasFiscais/CompletarDestinatarioModal'
import { EditarNcmInline } from '@/components/notasFiscais/EditarNcmInline'
import { NotaFiscalExtrasForm, criarNfeExtrasPadrao, extrasParaPayload, type NfeExtrasState } from '@/components/notasFiscais/NotaFiscalExtrasForm'

interface MissingField {
  field: string
  label: string
  where: 'empresa' | 'cliente' | 'produto'
  productName?: string
}

interface PreviewData {
  order: { id: string; order_number: string; total: number }
  customer: DestinatarioFiscalEditavel | null
  items: {
    id: string; name: string | null; quantity: number; unit_price: number
    product_ncm: string | null; product_id: string | null
  }[]
  company: { name: string }
  missingFields: MissingField[]
  existingInvoice: null | {
    id: string; status: string; bling_status: string | null; bling_invoice_id: string | null
    access_key: string | null; danfe_url: string | null; xml_url: string | null; error_message: string | null
  }
}

export default function NotaFiscalPedidoPage() {
  const params = useParams<{ orderId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [naturezaOperacao, setNaturezaOperacao] = useState('Venda de mercadoria')
  const [showClienteModal, setShowClienteModal] = useState(false)
  const [extras, setExtras] = useState<NfeExtrasState>(criarNfeExtrasPadrao())

  const { data, isLoading } = useQuery<PreviewData>({
    queryKey: ['notas_fiscais_preview', params.orderId],
    queryFn: async () => {
      const res = await fetch(`/api/notas-fiscais/pedido/${params.orderId}`)
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Falha ao carregar o pedido')
      return res.json()
    },
  })

  const criarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notas-fiscais/pedido/${params.orderId}/criar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naturezaOperacao, extras: extrasParaPayload(extras) }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Falha ao criar a nota no Bling')
      return body.invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas_fiscais_preview', params.orderId] })
      toast('success', 'Nota criada como rascunho no Bling. Revise e confirme o envio.')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  const enviarMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/notas-fiscais/${invoiceId}/enviar`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Falha ao enviar a nota')
      return body.invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas_fiscais_preview', params.orderId] })
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
      queryClient.invalidateQueries({ queryKey: ['notas_fiscais_preview', params.orderId] })
    },
    onError: (err: Error) => toast('error', err.message),
  })

  if (isLoading || !data) {
    return (
      <div className="p-4 sm:p-6">
        <Header title="Emitir Nota Fiscal" />
        <p className="text-sm text-text-muted mt-4">Carregando…</p>
      </div>
    )
  }

  const { order, customer, items, missingFields, existingInvoice } = data
  const hasMissing = missingFields.length > 0
  const canSend = existingInvoice?.bling_invoice_id
    && !['enviando', 'processando', 'autorizada', 'rejeitada', 'cancelada'].includes(existingInvoice.status)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
      <div>
        <button onClick={() => router.push('/notas-fiscais')} className="text-xs text-text-muted flex items-center gap-1 mb-2">
          <ArrowLeft size={13} /> Voltar
        </button>
        <Header title={`Nota Fiscal — Pedido #${order.order_number}`} subtitle={customer?.name ?? undefined} />
      </div>

      {hasMissing && (
        <div className="card p-4 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/10">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Faltam dados para emitir</p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                {missingFields.map((m, idx) => (
                  <li key={idx}>
                    • {m.label}{m.productName ? ` — ${m.productName}` : ''}
                    {m.where === 'empresa' && ' (completar em Configurações → Empresa)'}
                    {m.where === 'cliente' && ' — preencha ao lado em "Cliente"'}
                    {m.where === 'produto' && ' — preencha o NCM na lista de itens abaixo'}
                  </li>
                ))}
              </ul>
              {missingFields.some(m => m.where === 'cliente') && customer && (
                <button
                  type="button"
                  onClick={() => setShowClienteModal(true)}
                  className="btn-secondary text-xs flex items-center gap-1.5 mt-3"
                >
                  <Pencil size={12} /> Completar dados do cliente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      {/* Resumo do pedido aproveitado */}
      <div className="card p-5 space-y-3 lg:col-span-2">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Resumo</h3>
        <div className="text-sm text-text-secondary dark:text-stone-300 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p>Cliente: <span className="font-medium">{customer?.name ?? '—'}</span></p>
            {customer && (
              <button
                type="button"
                onClick={() => setShowClienteModal(true)}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Pencil size={10} /> editar dados fiscais
              </button>
            )}
          </div>
          <p>Total do pedido: <span className="font-medium">{formatCurrency(order.total)}</span></p>
        </div>
        <div className="divide-y divide-border dark:divide-border-dark rounded-xl border border-border dark:border-border-dark overflow-hidden mt-2">
          {items.map(item => (
            <div key={item.id} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
              <span className="text-text-secondary dark:text-stone-300 min-w-0 truncate">
                {item.quantity}x {item.name ?? 'Item'}
              </span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <EditarNcmInline
                  productId={item.product_id}
                  orderItemId={item.id}
                  initialValue={item.product_ncm}
                  onSaved={() => queryClient.invalidateQueries({ queryKey: ['notas_fiscais_preview', params.orderId] })}
                />
                <span className="text-text-muted whitespace-nowrap">{formatCurrency(item.unit_price)}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Natureza da operação</label>
          <input
            type="text"
            value={naturezaOperacao}
            onChange={e => setNaturezaOperacao(e.target.value)}
            disabled={!!existingInvoice}
            className="input w-full sm:w-80"
          />
          <p className="text-[11px] text-text-muted mt-1">
            Precisa ser o nome exato de uma natureza de operação já cadastrada na sua conta Bling
            (Cadastros → Naturezas de Operação) — o Bling usa esse cadastro para definir o CFOP da nota.
          </p>
        </div>
      </div>

      {/* Estado atual / ações */}
      <div className="card p-5 space-y-4 lg:col-span-1 lg:sticky lg:top-20">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Status</h3>

        {!existingInvoice && (
          <div>
            <p className="text-xs text-text-muted mb-3">
              Nenhuma nota criada ainda para este pedido. Isso cria um <strong>rascunho</strong> no Bling —
              a nota só é enviada para a SEFAZ depois, com uma confirmação separada.
            </p>
            <button
              type="button"
              onClick={() => criarMutation.mutate()}
              disabled={hasMissing || criarMutation.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {criarMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              Criar rascunho da nota no Bling
            </button>
          </div>
        )}

        {existingInvoice && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                  Status interno: <StatusBadge status={existingInvoice.status} />
                </p>
                {existingInvoice.bling_status && (
                  <p className="text-xs text-text-muted mt-1">Retorno do Bling: {existingInvoice.bling_status}</p>
                )}
                {existingInvoice.error_message && (
                  <p className="text-xs text-error mt-1">{existingInvoice.error_message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => refreshMutation.mutate(existingInvoice.id)}
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
                  onClick={() => enviarMutation.mutate(existingInvoice.id)}
                  disabled={enviarMutation.isPending}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {enviarMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Confirmar e enviar à SEFAZ
                </button>
              </div>
            )}

            {existingInvoice.status === 'autorizada' && (
              <div className="border-t border-border dark:border-border-dark pt-3 flex items-center gap-4">
                <span className="text-sm text-success-dark flex items-center gap-1.5"><CheckCircle2 size={15} /> Autorizada</span>
                {existingInvoice.access_key && (
                  <span className="text-xs text-text-muted">Chave: {existingInvoice.access_key}</span>
                )}
                {existingInvoice.danfe_url && (
                  <a href={existingInvoice.danfe_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1">
                    <FileText size={12} /> DANFE
                  </a>
                )}
                {existingInvoice.xml_url && (
                  <a href={existingInvoice.xml_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1">
                    <Download size={12} /> XML
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {!existingInvoice && (
        <NotaFiscalExtrasForm value={extras} onChange={setExtras} />
      )}

      {showClienteModal && customer && (
        <CompletarDestinatarioModal
          customer={customer}
          onClose={() => setShowClienteModal(false)}
          onSaved={() => {
            setShowClienteModal(false)
            queryClient.invalidateQueries({ queryKey: ['notas_fiscais_preview', params.orderId] })
          }}
        />
      )}
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
