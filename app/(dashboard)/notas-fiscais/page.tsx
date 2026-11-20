'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils/format'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Receipt, ExternalLink, CheckCircle2, AlertTriangle, Loader2, Unplug, FileText, Download,
  Search, X, FilePlus2, ClipboardList,
} from 'lucide-react'

interface BlingConnection {
  id: string
  bling_company_name: string | null
  status: 'connected' | 'disconnected' | 'error'
  last_error: string | null
}

interface FiscalInvoice {
  id: string
  status: string
  bling_status: string | null
  bling_number: string | null
  access_key: string | null
  danfe_url: string | null
  xml_url: string | null
  created_at: string
  error_message: string | null
  origin: 'pedido' | 'avulsa'
  avulsa_numero: string | null
  total: number | null
  order: { id: string; order_number: string; total: number } | null
  customer: { id: string; name: string } | null
}

interface OrderOption {
  id: string
  order_number: string
  total: number
  customer: { name: string } | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  rascunho:    { label: 'Rascunho',          cls: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
  enviando:    { label: 'Enviando…',         cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  processando: { label: 'Processando SEFAZ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  autorizada:  { label: 'Autorizada',        cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejeitada:   { label: 'Rejeitada',         cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  cancelada:   { label: 'Cancelada',         cls: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400' },
  erro:        { label: 'Erro',              cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const STATUS_FILTER_OPTIONS = ['rascunho', 'enviando', 'processando', 'autorizada', 'rejeitada', 'cancelada', 'erro']

export default function NotasFiscaisPage() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orderSearch, setOrderSearch] = useState('')
  const [showOrderPicker, setShowOrderPicker] = useState(false)

  const [listSearch, setListSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Retorno do fluxo OAuth (api/bling/oauth/callback)
  useEffect(() => {
    const bling = searchParams.get('bling')
    if (!bling) return
    const msg = searchParams.get('bling_msg')
    if (bling === 'success') toast('success', 'Conta do Bling conectada com sucesso!')
    else if (bling === 'error') toast('error', msg || 'Não foi possível conectar com o Bling')

    const url = new URL(window.location.href)
    url.searchParams.delete('bling')
    url.searchParams.delete('bling_msg')
    const qs = url.searchParams.toString()
    router.replace(qs ? `${url.pathname}?${qs}` : url.pathname)
  }, [searchParams, toast, router])

  const { data: connection, isLoading: loadingConnection } = useQuery<BlingConnection | null>({
    queryKey: ['bling_connection', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('bling_connections') as any)
        .select('id, bling_company_name, status, last_error')
        .eq('company_id', companyId!)
        .maybeSingle()
      return data ?? null
    },
  })

  const { data: invoicesData, isLoading: loadingInvoices } = useQuery<{ invoices: FiscalInvoice[] }>({
    queryKey: ['fiscal_invoices'],
    queryFn: async () => {
      const res = await fetch('/api/notas-fiscais')
      if (!res.ok) throw new Error('Falha ao carregar notas fiscais')
      return res.json()
    },
  })

  const { data: openOrders } = useQuery<OrderOption[]>({
    queryKey: ['notas_fiscais_order_options', companyId, orderSearch],
    enabled: !!companyId && showOrderPicker,
    queryFn: async () => {
      let query = (supabase.from('orders') as any)
        .select('id, order_number, total, customer:customers(name)')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(20)
      if (orderSearch) query = query.ilike('order_number', `%${orderSearch}%`)
      const { data } = await query
      return data ?? []
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from('bling_connections') as any)
        .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
        .eq('company_id', companyId!)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bling_connection', companyId] })
      toast('success', 'Conta do Bling desconectada')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  const isConnected = connection?.status === 'connected'
  const invoices = invoicesData?.invoices ?? []

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter && inv.status !== statusFilter) return false
      if (listSearch) {
        const needle = listSearch.toLowerCase()
        const haystack = [
          inv.order?.order_number, inv.avulsa_numero, inv.customer?.name, inv.bling_number,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [invoices, listSearch, statusFilter])

  function invoiceLabel(inv: FiscalInvoice) {
    if (inv.origin === 'avulsa') return inv.avulsa_numero || 'Avulsa'
    return `#${inv.order?.order_number ?? '—'}`
  }

  function invoiceHref(inv: FiscalInvoice) {
    if (inv.origin === 'avulsa') return `/notas-fiscais/avulsa/${inv.id}`
    return `/notas-fiscais/${inv.order?.id}`
  }

  function invoiceTotal(inv: FiscalInvoice) {
    return inv.origin === 'avulsa' ? (inv.total ?? 0) : (inv.order?.total ?? 0)
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <Header title="Notas Fiscais" subtitle="Emissão de NF-e via Bling — beta" />

      {/* Conexão com o Bling — faixa compacta, nunca domina a tela */}
      {!loadingConnection && (
        !isConnected ? (
          <div className="card p-4 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-white/5 text-primary flex-shrink-0">
              <Receipt size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Conectar com o Bling</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Conecte a conta do Bling da sua empresa para enviar os dados dos pedidos e emitir a NF-e.
              </p>
              {connection?.status === 'error' && connection.last_error && (
                <p className="text-xs text-error mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> {connection.last_error}
                </p>
              )}
              <a href="/api/bling/oauth/connect" className="btn-primary mt-3 inline-flex items-center gap-2 text-xs">
                <ExternalLink size={14} />
                Conectar conta do Bling
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-border dark:border-border-dark bg-success-light/40 dark:bg-success/5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={15} className="text-success-dark flex-shrink-0" />
              <p className="text-xs text-text-secondary dark:text-stone-300 truncate">
                Conectado ao Bling{connection?.bling_company_name ? `: ${connection.bling_company_name}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="text-[11px] text-text-muted hover:text-error flex items-center gap-1 flex-shrink-0"
            >
              {disconnectMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />}
              Desconectar
            </button>
          </div>
        )
      )}

      {/* Ações principais */}
      {isConnected && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowOrderPicker(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <ClipboardList size={15} /> Nova nota a partir de pedido
          </button>
          <Link href="/notas-fiscais/avulsa/nova" className="btn-secondary flex items-center gap-2 text-sm">
            <FilePlus2 size={15} /> Nova nota avulsa
          </Link>
        </div>
      )}

      {/* Lista de notas já emitidas/em andamento */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
            Notas fiscais {invoices.length > 0 && <span className="text-text-muted font-normal">({filteredInvoices.length}/{invoices.length})</span>}
          </h3>
        </div>

        {invoices.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar por pedido, cliente..."
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                className="input pl-9 w-full text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input text-xs w-auto"
            >
              <option value="">Todos os status</option>
              {STATUS_FILTER_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
              ))}
            </select>
          </div>
        )}

        {loadingInvoices ? (
          <SkeletonTable rows={4} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma nota fiscal ainda"
            description={isConnected
              ? 'Comece a partir de um pedido ou crie uma nota avulsa usando os botões acima.'
              : 'Conecte sua conta do Bling acima para começar a emitir notas fiscais.'}
          />
        ) : filteredInvoices.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">Nenhuma nota encontrada com esse filtro.</p>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-border dark:divide-border-dark -mx-5">
              {filteredInvoices.map(invoice => {
                const meta = STATUS_META[invoice.status] ?? { label: invoice.status, cls: 'bg-stone-100 text-stone-700' }
                return (
                  <Link key={invoice.id} href={invoiceHref(invoice)} className="block px-5 py-3 hover:bg-primary-50 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">
                          {invoiceLabel(invoice)}
                          {invoice.origin === 'avulsa' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary/10 text-primary">Avulsa</span>}
                        </p>
                        <p className="text-xs text-text-muted truncate">{invoice.customer?.name ?? '—'}</p>
                      </div>
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', meta.cls)}>{meta.label}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs text-text-muted">
                      <span>{format(new Date(invoice.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      <span className="font-medium text-text-secondary dark:text-stone-300">{formatCurrency(invoiceTotal(invoice))}</span>
                    </div>
                    {invoice.error_message && (
                      <p className="text-[10px] text-error mt-1 truncate">{invoice.error_message}</p>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-text-muted text-xs">
                  <tr>
                    <th className="text-left py-2 font-medium">Pedido/Origem</th>
                    <th className="text-left py-2 font-medium">Cliente</th>
                    <th className="text-left py-2 font-medium">Valor</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Data</th>
                    <th className="text-left py-2 font-medium">Documentos</th>
                    <th className="text-left py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-border-dark">
                  {filteredInvoices.map(invoice => {
                    const meta = STATUS_META[invoice.status] ?? { label: invoice.status, cls: 'bg-stone-100 text-stone-700' }
                    return (
                      <tr key={invoice.id}>
                        <td className="py-2 text-text-primary dark:text-stone-100">
                          {invoiceLabel(invoice)}
                          {invoice.bling_number && <span className="text-text-muted text-xs ml-1">(NF {invoice.bling_number})</span>}
                          {invoice.origin === 'avulsa' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary/10 text-primary">Avulsa</span>}
                        </td>
                        <td className="py-2 text-text-secondary dark:text-stone-300">{invoice.customer?.name ?? '—'}</td>
                        <td className="py-2 text-text-secondary dark:text-stone-300">{formatCurrency(invoiceTotal(invoice))}</td>
                        <td className="py-2">
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', meta.cls)}>{meta.label}</span>
                          {invoice.bling_status && (
                            <span className="block text-[10px] text-text-muted mt-0.5">Bling: {invoice.bling_status}</span>
                          )}
                          {invoice.error_message && (
                            <span className="block text-[10px] text-error mt-0.5 max-w-xs truncate" title={invoice.error_message}>
                              {invoice.error_message}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-text-muted text-xs">
                          {format(new Date(invoice.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
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
                        </td>
                        <td className="py-2">
                          <Link href={invoiceHref(invoice)} className="text-primary text-xs">Ver</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal: escolher pedido para iniciar nota */}
      {showOrderPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setShowOrderPicker(false)}>
          <div
            className="w-full sm:max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-modal max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
                <ClipboardList size={16} /> Iniciar nota a partir de um pedido
              </h3>
              <button onClick={() => setShowOrderPicker(false)} className="p-1 rounded-lg text-text-muted hover:bg-stone-100 dark:hover:bg-stone-800">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Buscar pedido por número…"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  className="input pl-9 w-full"
                  autoFocus
                />
              </div>
              <div className="divide-y divide-border dark:divide-border-dark rounded-xl border border-border dark:border-border-dark overflow-hidden max-h-72 overflow-y-auto">
                {(openOrders ?? []).length === 0 && (
                  <p className="px-3 py-3 text-xs text-text-muted">Nenhum pedido encontrado.</p>
                )}
                {(openOrders ?? []).map(order => (
                  <Link
                    key={order.id}
                    href={`/notas-fiscais/${order.id}`}
                    className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
                    onClick={() => setShowOrderPicker(false)}
                  >
                    <span className="text-text-secondary dark:text-stone-300">
                      Pedido #{order.order_number} — {order.customer?.name ?? 'Sem cliente'}
                    </span>
                    <span className="text-text-muted text-xs">Emitir nota →</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
