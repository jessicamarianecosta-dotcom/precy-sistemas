'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils/format'
import { normalizePhoneToWhatsapp, openWhatsappConversation } from '@/lib/orders/whatsapp'
import { fetchOrderReceivables, type OrderReceivable } from '@/lib/orders/receivables'
import {
  ArrowLeft, Edit2, MessageCircle, Mail, Phone, MapPin, Calendar,
  Loader2, UserX, Wallet, TrendingUp, AlertTriangle, ArrowDownCircle,
  ShoppingBag, X, Package, CreditCard, FileText, History,
  LayoutGrid, ClipboardList, Receipt,
} from 'lucide-react'

/* ─── Tipos ─── */
interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  cpf_cnpj: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  address: string | null
  created_at: string
  person_type: 'pf' | 'pj' | null
  trade_name: string | null
}

interface OrderItemRow {
  id: string
  name: string
  quantity: number
  unit_price: number
  subtotal: number
  variant_label: string | null
}

interface OrderRow {
  id: string
  order_number: string | null
  status: string
  payment_status: string
  total: number
  service_name: string | null
  payment_method: string | null
  order_date: string | null
  created_at: string
  due_date: string | null
  order_items: OrderItemRow[]
}

interface PaymentHistoryRow {
  id: string
  order_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  observation: string | null
}

interface ExpenseRow {
  id: string
  order_id: string | null
  amount: number
  date: string
  description: string
  payment_method: string | null
  category: string | null
}

interface BudgetRow {
  id: string
  budget_number: string | null
  status: string
  total: number
  created_at: string
  converted_to_order_id: string | null
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', production: 'Em produção', ready: 'Pronto',
  delivered: 'Concluído', cancelled: 'Cancelado',
}
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning-light text-warning-dark dark:bg-warning/10',
  production: 'bg-info-light text-info-dark dark:bg-info/10',
  ready: 'bg-success-light text-success-dark dark:bg-success/10',
  delivered: 'bg-primary-50 text-primary dark:bg-primary/10',
  cancelled: 'bg-error-light text-error dark:bg-error/10',
}
const RECEIVABLE_LABELS: Record<string, string> = {
  a_receber: 'A Receber', parcial: 'Parcial', recebido: 'Recebido',
  vencido: 'Vencido', cancelado: 'Cancelado',
}
const RECEIVABLE_COLORS: Record<string, string> = {
  a_receber: 'bg-warning-light text-warning-dark dark:bg-warning/10',
  parcial: 'bg-info-light text-info-dark dark:bg-info/10',
  recebido: 'bg-success-light text-success-dark dark:bg-success/10',
  vencido: 'bg-error-light text-error dark:bg-error/10',
  cancelado: 'bg-stone-100 text-stone-500 dark:bg-stone-800',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', className)}>
      {label}
    </span>
  )
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

type TabId = 'visao' | 'pedidos' | 'financeiro' | 'historico'
const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'visao', label: 'Visão Geral', icon: LayoutGrid },
  { id: 'pedidos', label: 'Pedidos', icon: ClipboardList },
  { id: 'financeiro', label: 'Financeiro', icon: Receipt },
  { id: 'historico', label: 'Histórico', icon: History },
]

export default function FichaClientePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const customerId = params.id
  const { companyId } = useCompanyId()

  const [tab, setTab] = useState<TabId>('visao')
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterSituacao, setFilterSituacao] = useState<string>('')
  const [filterFrom, setFilterFrom] = useState<string>('')
  const [filterTo, setFilterTo] = useState<string>('')

  const { data: customer, isLoading: loadingCustomer, isError: customerError } = useQuery<Customer | null>({
    queryKey: ['customer-detail', customerId, companyId],
    enabled: !!customerId && !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*')
        .eq('id', customerId).eq('company_id', companyId!).maybeSingle()
      return data as Customer | null
    },
  })

  const { data: orders, isLoading: loadingOrders } = useQuery<OrderRow[]>({
    queryKey: ['customer-orders', customerId, companyId],
    enabled: !!customerId && !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from('orders')
        .select('id, order_number, status, payment_status, total, service_name, payment_method, order_date, created_at, due_date, order_items(id, name, quantity, unit_price, subtotal, variant_label)')
        .eq('customer_id', customerId).eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      return (data as any as OrderRow[]) ?? []
    },
  })

  const { data: receivables, isLoading: loadingReceivables } = useQuery<OrderReceivable[]>({
    queryKey: ['customer-receivables', customerId, companyId],
    enabled: !!customerId && !!companyId,
    queryFn: async () => fetchOrderReceivables(supabase, companyId!, customerId),
  })

  const { data: paymentHistory, isLoading: loadingPayments } = useQuery<PaymentHistoryRow[]>({
    queryKey: ['customer-payment-history', customerId, companyId],
    enabled: !!customerId && !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from('payment_history')
        .select('id, order_id, amount, payment_date, payment_method, observation')
        .eq('customer_id', customerId).eq('company_id', companyId!)
        .order('payment_date', { ascending: false })
      return (data as PaymentHistoryRow[]) ?? []
    },
  })

  const orderIds = useMemo(() => (orders ?? []).map(o => o.id), [orders])

  const { data: expenses } = useQuery<ExpenseRow[]>({
    queryKey: ['customer-expenses', customerId, orderIds.join(',')],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('financial_transactions')
        .select('id, order_id, amount, date, description, payment_method, category')
        .eq('type', 'expense').in('order_id', orderIds)
        .order('date', { ascending: false })
      return (data as ExpenseRow[]) ?? []
    },
  })

  const { data: budgets } = useQuery<BudgetRow[]>({
    queryKey: ['customer-budgets', customerId, companyId],
    enabled: !!customerId && !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from('budgets')
        .select('id, budget_number, status, total, created_at, converted_to_order_id')
        .eq('customer_id', customerId).eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      return (data as BudgetRow[]) ?? []
    },
  })

  const isLoading = loadingCustomer || loadingOrders || loadingReceivables || loadingPayments || !companyId

  /* ── Totais ── */
  const receivableByOrder = useMemo(() => {
    const map: Record<string, OrderReceivable> = {}
    ;(receivables ?? []).forEach(r => { map[r.orderId] = r })
    return map
  }, [receivables])

  const totalCompras = useMemo(
    () => (orders ?? []).filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0),
    [orders]
  )
  const totalRecebido = useMemo(
    () => (receivables ?? []).reduce((s, r) => s + r.received, 0),
    [receivables]
  )
  const totalAReceber = useMemo(
    () => (receivables ?? []).filter(r => r.status === 'a_receber' || r.status === 'parcial' || r.status === 'vencido')
      .reduce((s, r) => s + r.balance, 0),
    [receivables]
  )
  const totalVencido = useMemo(
    () => (receivables ?? []).filter(r => r.status === 'vencido').reduce((s, r) => s + r.balance, 0),
    [receivables]
  )
  const totalPagoAoCliente = useMemo(
    () => (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  )
  const pedidosStats = useMemo(() => {
    const list = orders ?? []
    const emAndamento = list.filter(o => ['pending', 'production', 'ready'].includes(o.status)).length
    const concluidos = list.filter(o => o.status === 'delivered').length
    return { total: list.length, emAndamento, concluidos }
  }, [orders])

  /* ── Filtros aba Pedidos ── */
  const filteredOrders = useMemo(() => {
    return (orders ?? []).filter(o => {
      if (filterStatus && o.status !== filterStatus) return false
      if (filterSituacao) {
        const sit = receivableByOrder[o.id]?.status ?? ''
        if (sit !== filterSituacao) return false
      }
      const refDate = o.order_date ?? o.created_at
      if (filterFrom && refDate < filterFrom) return false
      if (filterTo && refDate > filterTo) return false
      return true
    })
  }, [orders, filterStatus, filterSituacao, filterFrom, filterTo, receivableByOrder])

  /* ── Timeline (aba Histórico) ── */
  const timeline = useMemo(() => {
    type Ev = { date: string; title: string; description: string; icon: React.ElementType; color: string }
    const events: Ev[] = []
    if (customer) {
      events.push({
        date: customer.created_at, title: 'Cadastro realizado',
        description: 'Cliente cadastrado no Precy+.', icon: UserX, color: 'text-primary bg-primary-50 dark:bg-primary/10',
      })
    }
    ;(budgets ?? []).forEach(b => {
      events.push({
        date: b.created_at, title: `Orçamento ${b.budget_number ?? ''} criado`,
        description: `Valor de ${formatCurrency(b.total)}.`, icon: FileText, color: 'text-info-dark bg-info-light dark:bg-info/10',
      })
      if (b.status === 'converted' && b.converted_to_order_id) {
        events.push({
          date: b.created_at, title: `Orçamento ${b.budget_number ?? ''} convertido em pedido`,
          description: 'Orçamento aprovado e convertido.', icon: ShoppingBag, color: 'text-success-dark bg-success-light dark:bg-success/10',
        })
      }
    })
    ;(orders ?? []).forEach(o => {
      events.push({
        date: o.created_at, title: `Pedido ${o.order_number ?? ''} criado`,
        description: `${formatCurrency(o.total)} · ${ORDER_STATUS_LABELS[o.status] ?? o.status}`,
        icon: ShoppingBag, color: 'text-primary bg-primary-50 dark:bg-primary/10',
      })
      if (o.status === 'cancelled') {
        events.push({
          date: o.created_at, title: `Pedido ${o.order_number ?? ''} cancelado`,
          description: 'Pedido cancelado.', icon: X, color: 'text-error bg-error-light dark:bg-error/10',
        })
      }
    })
    ;(paymentHistory ?? []).forEach(p => {
      const order = (orders ?? []).find(o => o.id === p.order_id)
      events.push({
        date: p.payment_date, title: 'Pagamento recebido',
        description: `${formatCurrency(p.amount)}${order?.order_number ? ` · Pedido ${order.order_number}` : ''}`,
        icon: Wallet, color: 'text-success-dark bg-success-light dark:bg-success/10',
      })
    })
    ;(expenses ?? []).forEach(e => {
      const order = (orders ?? []).find(o => o.id === e.order_id)
      events.push({
        date: e.date, title: 'Reembolso / pagamento ao cliente',
        description: `${formatCurrency(e.amount)}${order?.order_number ? ` · Pedido ${order.order_number}` : ''}`,
        icon: ArrowDownCircle, color: 'text-warning-dark bg-warning-light dark:bg-warning/10',
      })
    })
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [customer, orders, budgets, paymentHistory, expenses])

  /* ── WhatsApp ── */
  function handleWhatsApp() {
    if (!customer?.phone) return
    const phone = normalizePhoneToWhatsapp(customer.phone)
    if (!phone) return
    openWhatsappConversation(phone, `Olá ${customer.name.split(' ')[0]}! `)
  }

  /* ── Estados de carregamento / erro ── */
  if (isLoading) {
    return (
      <div className="page-enter">
        <Header title="Ficha do Cliente" />
        <div className="p-10 flex justify-center">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      </div>
    )
  }

  if (customerError || !customer) {
    return (
      <div className="page-enter">
        <Header title="Ficha do Cliente" />
        <div className="p-6">
          <EmptyState
            icon={UserX}
            title="Cliente não encontrado"
            description="Ele pode ter sido excluído, ou pertence a outra conta."
            action={{ label: 'Voltar para Clientes', onClick: () => router.push('/clientes') }}
          />
        </div>
      </div>
    )
  }

  const fullAddress = [
    customer.street && `${customer.street}${customer.number ? `, ${customer.number}` : ''}`,
    customer.complement, customer.neighborhood,
    [customer.city, customer.state].filter(Boolean).join(' - '),
  ].filter(Boolean).join(' · ') || customer.address || null

  const cards = [
    { icon: ShoppingBag, label: 'Total em Compras', value: formatCurrency(totalCompras), color: 'text-primary', bg: 'bg-primary-50 dark:bg-primary/10' },
    { icon: Wallet, label: 'Total Recebido', value: formatCurrency(totalRecebido), color: 'text-success', bg: 'bg-success-light dark:bg-success/10' },
    { icon: TrendingUp, label: 'A Receber', value: formatCurrency(totalAReceber), color: 'text-warning', bg: 'bg-warning-light dark:bg-warning/10' },
    { icon: ArrowDownCircle, label: 'Pago ao Cliente', value: formatCurrency(totalPagoAoCliente), color: 'text-info', bg: 'bg-info-light dark:bg-info/10' },
    {
      icon: ClipboardList, label: 'Pedidos',
      value: `${pedidosStats.total} (${pedidosStats.emAndamento} ativos)`,
      color: 'text-text-primary dark:text-stone-100', bg: 'bg-stone-100 dark:bg-white/5',
    },
  ]

  return (
    <div className="page-enter">
      <Header title={customer.name} subtitle="Ficha completa do cliente" />

      <div className="p-4 sm:p-6 space-y-5">
        {/* ── Voltar ── */}
        <button
          onClick={() => router.push('/clientes')}
          className="flex items-center gap-1.5 text-sm text-text-secondary dark:text-stone-400 hover:text-primary transition-colors"
        >
          <ArrowLeft size={15} /> Voltar para Clientes
        </button>

        {/* ── Cabeçalho ── */}
        <div className="card p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary/20 text-primary flex items-center justify-center text-lg font-bold flex-shrink-0">
                {initials(customer.name)}
              </div>
              <div className="min-w-0 space-y-1.5">
                <h1 className="text-lg font-bold text-text-primary dark:text-stone-100 break-words">
                  {customer.name}
                  {customer.trade_name && (
                    <span className="text-sm font-normal text-text-muted ml-2">({customer.trade_name})</span>
                  )}
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary dark:text-stone-400">
                  {customer.phone && (
                    <span className="flex items-center gap-1.5"><Phone size={12} /> {customer.phone}</span>
                  )}
                  {customer.email && (
                    <span className="flex items-center gap-1.5"><Mail size={12} /> {customer.email}</span>
                  )}
                  {customer.cpf_cnpj && (
                    <span>{customer.cpf_cnpj}</span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} /> Cliente desde {format(new Date(customer.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>
                {fullAddress && (
                  <p className="flex items-start gap-1.5 text-xs text-text-muted dark:text-stone-500">
                    <MapPin size={12} className="flex-shrink-0 mt-0.5" /> {fullAddress}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {customer.phone && (
                <button onClick={handleWhatsApp} className="btn-secondary flex items-center gap-2">
                  <MessageCircle size={14} /> WhatsApp
                </button>
              )}
              <button onClick={() => router.push(`/clientes?edit=${customer.id}`)} className="btn-primary flex items-center gap-2">
                <Edit2 size={14} /> Editar cadastro
              </button>
            </div>
          </div>
        </div>

        {/* ── Cards resumo ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {cards.map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className="card flex items-center gap-3 p-4">
                <div className={clsx('p-2.5 rounded-xl flex-shrink-0', c.bg)}>
                  <Icon size={17} className={c.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-text-muted dark:text-stone-400 uppercase tracking-wider">{c.label}</p>
                  <p className={clsx('text-sm font-bold truncate', c.color)}>{c.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Abas ── */}
        <div className="flex gap-1 border-b border-border dark:border-border-dark overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                  tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted dark:text-stone-400 hover:text-text-primary dark:hover:text-stone-200'
                )}
              >
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* ── VISÃO GERAL ── */}
        {tab === 'visao' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Últimos pedidos</h3>
              {(orders ?? []).length === 0 ? (
                <p className="text-xs text-text-muted">Este cliente ainda não tem pedidos.</p>
              ) : (
                <div className="space-y-2">
                  {(orders ?? []).slice(0, 5).map(o => (
                    <button
                      key={o.id}
                      onClick={() => setDetailOrder(o)}
                      className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-primary-50/40 dark:hover:bg-white/[0.03] transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary dark:text-stone-100">Pedido {o.order_number ?? '—'}</p>
                        <p className="text-[11px] text-text-muted">{format(new Date(o.order_date ?? o.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge label={ORDER_STATUS_LABELS[o.status] ?? o.status} className={ORDER_STATUS_COLORS[o.status] ?? ''} />
                        <span className="text-xs font-bold text-text-primary dark:text-stone-100">{formatCurrency(o.total)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Próximos vencimentos</h3>
              {(receivables ?? []).filter(r => r.status !== 'recebido' && r.status !== 'cancelado').length === 0 ? (
                <p className="text-xs text-text-muted">Nenhum valor pendente para este cliente.</p>
              ) : (
                <div className="space-y-2">
                  {(receivables ?? [])
                    .filter(r => r.status !== 'recebido' && r.status !== 'cancelado')
                    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
                    .slice(0, 6)
                    .map(r => (
                      <div key={r.orderId} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-stone-50 dark:bg-white/[0.02]">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary dark:text-stone-100">Pedido {r.orderNumber ?? '—'}</p>
                          <p className="text-[11px] text-text-muted">
                            {r.dueDate ? `Vence em ${format(new Date(r.dueDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}` : 'Sem vencimento'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge label={RECEIVABLE_LABELS[r.status]} className={RECEIVABLE_COLORS[r.status]} />
                          <span className="text-xs font-bold text-text-primary dark:text-stone-100">{formatCurrency(r.balance)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PEDIDOS ── */}
        {tab === 'pedidos' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <select className="input sm:w-44" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Todos os status</option>
                {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="input sm:w-48" value={filterSituacao} onChange={e => setFilterSituacao(e.target.value)}>
                <option value="">Toda situação financeira</option>
                {Object.entries(RECEIVABLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="date" className="input sm:w-40" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              <input type="date" className="input sm:w-40" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
            </div>

            <div className="card p-0 overflow-hidden">
              {filteredOrders.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="Nenhum pedido encontrado" description="Este cliente não possui pedidos com os filtros selecionados." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border dark:border-border-dark">
                        {['Pedido', 'Data', 'Produtos', 'Valor Total', 'Pago', 'Pendente', 'Pagamento', 'Status'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(o => {
                        const rec = receivableByOrder[o.id]
                        const items = o.order_items ?? []
                        return (
                          <tr
                            key={o.id}
                            className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                            onClick={() => setDetailOrder(o)}
                          >
                            <td className="px-4 py-3 text-xs font-semibold text-text-primary dark:text-stone-100 whitespace-nowrap">{o.order_number ?? '—'}</td>
                            <td className="px-4 py-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">
                              {format(new Date(o.order_date ?? o.created_at), 'dd/MM/yy', { locale: ptBR })}
                            </td>
                            <td className="px-4 py-3 text-xs text-text-secondary dark:text-stone-400 max-w-[220px]">
                              <span className="truncate block">
                                {items.length > 0 ? items.map(i => `${i.quantity}x ${i.name}${i.variant_label ? ` (${i.variant_label})` : ''}`).join(', ') : (o.service_name ?? '—')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-text-primary dark:text-stone-100 whitespace-nowrap">{formatCurrency(o.total)}</td>
                            <td className="px-4 py-3 text-xs text-success-dark whitespace-nowrap">{formatCurrency(rec?.received ?? 0)}</td>
                            <td className="px-4 py-3 text-xs text-warning-dark whitespace-nowrap">{formatCurrency(rec?.balance ?? 0)}</td>
                            <td className="px-4 py-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap capitalize">{o.payment_method ?? '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge label={ORDER_STATUS_LABELS[o.status] ?? o.status} className={ORDER_STATUS_COLORS[o.status] ?? ''} />
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
        )}

        {/* ── FINANCEIRO ── */}
        {tab === 'financeiro' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Total Comprado', value: totalCompras, color: 'text-primary' },
                { label: 'Total Recebido', value: totalRecebido, color: 'text-success' },
                { label: 'A Receber', value: totalAReceber, color: 'text-warning' },
                { label: 'Vencido', value: totalVencido, color: 'text-error' },
                { label: 'Pago ao Cliente', value: totalPagoAoCliente, color: 'text-info' },
              ].map(s => (
                <div key={s.label} className="card p-3">
                  <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{s.label}</p>
                  <p className={clsx('text-sm font-bold mt-1', s.color)}>{formatCurrency(s.value)}</p>
                </div>
              ))}
            </div>

            {/* Contas a receber */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-2 flex items-center gap-1.5">
                <CreditCard size={14} /> Contas a receber
              </h3>
              <div className="card p-0 overflow-hidden">
                {(receivables ?? []).length === 0 ? (
                  <EmptyState icon={CreditCard} title="Nenhum valor a receber" description="Este cliente não possui contas a receber." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border dark:border-border-dark">
                          {['Pedido', 'Vencimento', 'Valor Original', 'Recebido', 'Saldo', 'Pagamento', 'Situação'].map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(receivables ?? []).map(r => (
                          <tr key={r.orderId} className="border-b border-border dark:border-border-dark last:border-0">
                            <td className="px-4 py-3 text-xs font-semibold text-text-primary dark:text-stone-100 whitespace-nowrap">
                              {r.orderNumber ?? '—'}{r.serviceName ? ` · ${r.serviceName}` : ''}
                            </td>
                            <td className="px-4 py-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">
                              {r.dueDate ? format(new Date(r.dueDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-text-primary dark:text-stone-100 whitespace-nowrap">{formatCurrency(r.total)}</td>
                            <td className="px-4 py-3 text-xs text-success-dark whitespace-nowrap">{formatCurrency(r.received)}</td>
                            <td className="px-4 py-3 text-xs text-warning-dark whitespace-nowrap">{formatCurrency(r.balance)}</td>
                            <td className="px-4 py-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap capitalize">{r.paymentMethod ?? '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap"><Badge label={RECEIVABLE_LABELS[r.status]} className={RECEIVABLE_COLORS[r.status]} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de pagamentos e movimentações */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-2 flex items-center gap-1.5">
                <Wallet size={14} /> Histórico de pagamentos e movimentações
              </h3>
              <div className="card p-0 overflow-hidden">
                {(paymentHistory ?? []).length === 0 && (expenses ?? []).length === 0 ? (
                  <EmptyState icon={Wallet} title="Nenhuma movimentação" description="Este cliente ainda não possui pagamentos ou movimentações registradas." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border dark:border-border-dark">
                          {['Data', 'Descrição', 'Pedido', 'Tipo', 'Pagamento', 'Valor', 'Situação'].map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...(paymentHistory ?? []).map(p => ({
                            date: p.payment_date,
                            desc: p.observation || 'Recebimento de pagamento',
                            order: (orders ?? []).find(o => o.id === p.order_id)?.order_number ?? '—',
                            tipo: 'Recebimento', color: 'text-success-dark',
                            method: p.payment_method, amount: p.amount,
                          })),
                          ...(expenses ?? []).map(e => ({
                            date: e.date,
                            desc: e.description || 'Pagamento ao cliente',
                            order: (orders ?? []).find(o => o.id === e.order_id)?.order_number ?? '—',
                            tipo: 'Reembolso/Saída', color: 'text-warning-dark',
                            method: e.payment_method, amount: e.amount,
                          })),
                        ]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((m, i) => (
                            <tr key={i} className="border-b border-border dark:border-border-dark last:border-0">
                              <td className="px-4 py-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">
                                {format(new Date(m.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </td>
                              <td className="px-4 py-3 text-xs text-text-primary dark:text-stone-100">{m.desc}</td>
                              <td className="px-4 py-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">{m.order}</td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap"><span className={m.color}>{m.tipo}</span></td>
                              <td className="px-4 py-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap capitalize">{m.method ?? '—'}</td>
                              <td className={clsx('px-4 py-3 text-xs font-bold whitespace-nowrap', m.color)}>{formatCurrency(m.amount)}</td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap"><Badge label="Concluído" className="bg-success-light text-success-dark dark:bg-success/10" /></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTÓRICO ── */}
        {tab === 'historico' && (
          <div className="card p-4 sm:p-5">
            {timeline.length === 0 ? (
              <EmptyState icon={History} title="Sem histórico" description="Nenhum evento registrado para este cliente ainda." />
            ) : (
              <div className="space-y-0">
                {timeline.map((ev, i) => {
                  const Icon = ev.icon
                  return (
                    <div key={i} className="flex gap-3 pb-5 last:pb-0 relative">
                      {i < timeline.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border dark:bg-border-dark" />
                      )}
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10', ev.color)}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{ev.title}</p>
                        <p className="text-xs text-text-secondary dark:text-stone-400 mt-0.5">{ev.description}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">{format(new Date(ev.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ MODAL DETALHE DO PEDIDO ══ */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailOrder(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 pb-4 border-b border-border dark:border-border-dark flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-text-primary dark:text-stone-100">Pedido {detailOrder.order_number ?? '—'}</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {format(new Date(detailOrder.order_date ?? detailOrder.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <button onClick={() => setDetailOrder(null)} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Badge label={ORDER_STATUS_LABELS[detailOrder.status] ?? detailOrder.status} className={ORDER_STATUS_COLORS[detailOrder.status] ?? ''} />
                <Badge
                  label={RECEIVABLE_LABELS[receivableByOrder[detailOrder.id]?.status ?? 'a_receber']}
                  className={RECEIVABLE_COLORS[receivableByOrder[detailOrder.id]?.status ?? 'a_receber']}
                />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package size={12} /> Produtos
                </h4>
                <div className="space-y-1.5">
                  {(detailOrder.order_items ?? []).length === 0 ? (
                    <p className="text-xs text-text-muted">{detailOrder.service_name ?? 'Sem itens detalhados.'}</p>
                  ) : (
                    detailOrder.order_items.map(i => (
                      <div key={i.id} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary dark:text-stone-300">
                          {i.quantity}x {i.name}{i.variant_label ? ` — ${i.variant_label}` : ''}
                        </span>
                        <span className="font-medium text-text-primary dark:text-stone-100">{formatCurrency(i.subtotal)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border dark:border-border-dark">
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Total</p>
                  <p className="text-sm font-bold text-text-primary dark:text-stone-100">{formatCurrency(detailOrder.total)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Pago</p>
                  <p className="text-sm font-bold text-success-dark">{formatCurrency(receivableByOrder[detailOrder.id]?.received ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Pendente</p>
                  <p className="text-sm font-bold text-warning-dark">{formatCurrency(receivableByOrder[detailOrder.id]?.balance ?? 0)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Pagamentos vinculados</h4>
                {(paymentHistory ?? []).filter(p => p.order_id === detailOrder.id).length === 0 ? (
                  <p className="text-xs text-text-muted">Nenhum pagamento registrado para este pedido.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(paymentHistory ?? []).filter(p => p.order_id === detailOrder.id).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary dark:text-stone-300">
                          {format(new Date(p.payment_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} · {p.payment_method ?? '—'}
                        </span>
                        <span className="font-medium text-success-dark">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 pt-3 border-t border-border dark:border-border-dark flex-shrink-0">
              <button
                onClick={() => router.push('/pedidos')}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                Ver no módulo Pedidos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
