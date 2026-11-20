'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Receipt, ExternalLink, CheckCircle2, AlertTriangle, Loader2, Unplug, FileText, Download,
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

export default function NotasFiscaisPage() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orderSearch, setOrderSearch] = useState('')

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
    enabled: !!companyId,
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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Header title="Notas Fiscais" subtitle="Emissão de NF-e via Bling — beta" />

      {/* Conexão com o Bling */}
      {!loadingConnection && (
        !isConnected ? (
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-white/5 text-primary">
                <Receipt size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Conectar com o Bling</h3>
                <p className="text-xs text-text-muted mt-1">
                  Conecte a conta do Bling da sua empresa para enviar os dados dos pedidos e emitir a NF-e.
                  O Bling continua responsável pelo processamento fiscal — o Precy+ só envia os dados e mostra o resultado.
                </p>
                {connection?.status === 'error' && connection.last_error && (
                  <p className="text-xs text-error mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> {connection.last_error}
                  </p>
                )}
                <a href="/api/bling/oauth/connect" className="btn-primary mt-3 inline-flex items-center gap-2">
                  <ExternalLink size={15} />
                  Conectar conta do Bling
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-success-light text-success-dark">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                  Conectado{connection?.bling_company_name ? `: ${connection.bling_company_name}` : ''}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">As notas fiscais emitidas aqui vão para esta conta do Bling.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              {disconnectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />}
              Desconectar
            </button>
          </div>
        )
      )}

      {/* Iniciar nova nota a partir de um pedido */}
      {isConnected && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Iniciar nota a partir de um pedido</h3>
          <input
            type="text"
            placeholder="Buscar pedido por número…"
            value={orderSearch}
            onChange={e => setOrderSearch(e.target.value)}
            className="input w-full sm:w-72"
          />
          <div className="divide-y divide-border dark:divide-border-dark rounded-xl border border-border dark:border-border-dark overflow-hidden">
            {(openOrders ?? []).length === 0 && (
              <p className="px-3 py-3 text-xs text-text-muted">Nenhum pedido encontrado.</p>
            )}
            {(openOrders ?? []).map(order => (
              <Link
                key={order.id}
                href={`/notas-fiscais/${order.id}`}
                className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
              >
                <span className="text-text-secondary dark:text-stone-300">
                  Pedido #{order.order_number} — {order.customer?.name ?? 'Sem cliente'}
                </span>
                <span className="text-text-muted text-xs">Emitir nota →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Lista de notas já emitidas/em andamento */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Notas fiscais</h3>
        {loadingInvoices ? (
          <SkeletonTable rows={4} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma nota fiscal ainda"
            description="Comece selecionando um pedido acima para iniciar a primeira nota fiscal."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-text-muted text-xs">
                <tr>
                  <th className="text-left py-2 font-medium">Pedido</th>
                  <th className="text-left py-2 font-medium">Cliente</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Data</th>
                  <th className="text-left py-2 font-medium">Documentos</th>
                  <th className="text-left py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-border-dark">
                {invoices.map(invoice => {
                  const meta = STATUS_META[invoice.status] ?? { label: invoice.status, cls: 'bg-stone-100 text-stone-700' }
                  return (
                    <tr key={invoice.id}>
                      <td className="py-2 text-text-primary dark:text-stone-100">
                        #{invoice.order?.order_number ?? '—'}
                        {invoice.bling_number && <span className="text-text-muted text-xs ml-1">(NF {invoice.bling_number})</span>}
                      </td>
                      <td className="py-2 text-text-secondary dark:text-stone-300">{invoice.customer?.name ?? '—'}</td>
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
                        {invoice.order?.id && (
                          <Link href={`/notas-fiscais/${invoice.order.id}`} className="text-primary text-xs">Ver</Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
