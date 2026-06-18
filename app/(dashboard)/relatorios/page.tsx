'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { clsx } from 'clsx'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Package, FileText, BarChart3, ChevronDown,
  Download, AlertTriangle, CheckCircle, Clock, ArrowUpRight,
  ArrowDownRight, Star, Loader2, Printer,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, parseISO, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils/format'

/* ─── Helpers ─── */
const fmt = (v: unknown) => formatCurrency(Number(v) || 0)

const fmtN = (v: unknown) => Number(v || 0).toLocaleString('pt-BR')

type Period = 'month' | 'last_month' | 'quarter' | 'year' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Este mês', last_month: 'Mês anterior',
  quarter: 'Trimestre', year: 'Este ano', all: 'Todo período',
}

const COLORS = ['#8B6C4F', '#B8956A', '#5C8B4F', '#4F6B8B', '#8B4F7A', '#7A8B4F']

const ORDER_STATUS = {
  pending:    { label: 'Pendente',   color: '#F59E0B' },
  production: { label: 'Produção',   color: '#3B82F6' },
  ready:      { label: 'Pronto',     color: '#10B981' },
  delivered:  { label: 'Entregue',   color: '#8B6C4F' },
}

const BUDGET_STATUS = {
  draft:     { label: 'Rascunho',   color: '#9CA3AF' },
  sent:      { label: 'Enviado',    color: '#3B82F6' },
  approved:  { label: 'Aprovado',   color: '#10B981' },
  rejected:  { label: 'Recusado',   color: '#EF4444' },
  converted: { label: 'Convertido', color: '#8B6C4F' },
}

/* ─── KPI Card ─── */
function KPI({ label, value, sub, icon: Icon, trend, color = 'text-primary' }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  trend?: 'up'|'down'|null; color?: string
}) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">{label}</p>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10')}>
          <Icon size={14} className={color} />
        </div>
      </div>
      <p className={clsx('text-2xl font-bold', color)}>{value}</p>
      {sub && (
        <p className="text-[11px] text-text-muted dark:text-stone-500 flex items-center gap-1">
          {trend === 'up'   && <ArrowUpRight   size={11} className="text-green-500" />}
          {trend === 'down' && <ArrowDownRight size={11} className="text-red-500"   />}
          {sub}
        </p>
      )}
    </div>
  )
}

/* ─── Section wrapper ─── */
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-primary" />
        <h2 className="text-sm font-bold text-text-primary dark:text-stone-100">{title}</h2>
      </div>
      {children}
    </div>
  )
}

/* ──────────────────────────────────────────────
   PAGE
────────────────────────────────────────────── */
export default function RelatoriosPage() {
  const supabase      = createClient()
  const { companyId } = useCompanyId()
  const [period, setPeriod] = useState<Period>('month')
  const [activeTab, setActiveTab] = useState<'financeiro'|'pedidos'|'clientes'|'produtos'|'estoque'|'orcamentos'>('financeiro')
  const [exporting, setExporting] = useState(false)

  /* ── Buscar dados da empresa para o PDF ── */
  const { data: companyData } = useQuery({
    queryKey: ['company-report', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('companies') as any)
        .select('name, email, cnpj, phone, primary_color, logo_url').eq('id', companyId!).single()
      return data
    },
  })

  async function handleExportPDF(mode: 'pdf' | 'print' = 'pdf') {
    setExporting(true)
    try {
      const { generateReportPDF } = await import('@/lib/pdf/generateReportPDF')
      generateReportPDF({
        tab: activeTab, period, start, end,
        company:   companyData,
        finTx,
        orders,
        customers,
        products,
        inventory,
        budgets,
        mode,
      })
    } catch (err) { console.error('[export]', err) }
    finally { setExporting(false) }
  }

  /* ── Period range ── */
  const { start, end } = useMemo(() => {
    const now = new Date()
    if (period === 'month')      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') }
    if (period === 'last_month') return { start: format(startOfMonth(subMonths(now,1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(now,1)), 'yyyy-MM-dd') }
    if (period === 'quarter')    return { start: format(startOfMonth(subMonths(now,2)), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') }
    if (period === 'year')       return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }
    return { start: '2020-01-01', end: format(endOfMonth(addMonths(now,12)), 'yyyy-MM-dd') }
  }, [period])

  /* ── Queries ── */
  const q = { queryKey: [] as any[], enabled: !!companyId }

  const { data: finTx = [] } = useQuery<any[]>({
    ...q, queryKey: ['rep-fin', companyId, start, end],
    queryFn: async () => {
      const { data } = await (supabase.from('financial_transactions') as any)
        .select('type, category, amount, date, status')
        .eq('company_id', companyId!).gte('date', start).lte('date', end)
      return data ?? []
    },
  })

  const { data: orders = [] } = useQuery<any[]>({
    ...q, queryKey: ['rep-orders', companyId, start, end],
    queryFn: async () => {
      const { data } = await (supabase.from('orders') as any)
        .select('id, status, total, due_date, customers(name), service_name, created_at')
        .eq('company_id', companyId!)
        .gte('created_at', start + 'T00:00:00')
        .lte('created_at', end   + 'T23:59:59')
      return data ?? []
    },
  })

  const { data: customers = [] } = useQuery<any[]>({
    ...q, queryKey: ['rep-customers', companyId],
    queryFn: async () => {
      const { data } = await (supabase.from('customers') as any)
        .select('id, name, created_at').eq('company_id', companyId!)
      return data ?? []
    },
  })

  const { data: products = [] } = useQuery<any[]>({
    ...q, queryKey: ['rep-products', companyId],
    queryFn: async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, final_price, total_cost, category, is_active')
        .eq('company_id', companyId!)
      return data ?? []
    },
  })

  const { data: inventory = [] } = useQuery<any[]>({
    ...q, queryKey: ['rep-inventory', companyId],
    queryFn: async () => {
      const { data } = await (supabase.from('inventory') as any)
        .select('id, name, quantity, minimum_quantity, cost_per_unit, category, status')
        .eq('company_id', companyId!)
      return data ?? []
    },
  })

  const { data: budgets = [] } = useQuery<any[]>({
    ...q, queryKey: ['rep-budgets', companyId, start, end],
    queryFn: async () => {
      const { data } = await (supabase.from('budgets') as any)
        .select('id, status, total, created_at, customers(name)')
        .eq('company_id', companyId!)
        .gte('created_at', start + 'T00:00:00')
        .lte('created_at', end   + 'T23:59:59')
      return data ?? []
    },
  })

  /* ── Computed ── */
  // Financeiro
  const finRealized = finTx.filter(t => t.status === 'received' || t.status === 'paid')
  const totalInc    = finRealized.filter(t => t.type === 'income') .reduce((s,t) => s + Number(t.amount), 0)
  const totalExp    = finRealized.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
  const balance     = totalInc - totalExp
  const margin      = totalInc > 0 ? (balance / totalInc) * 100 : 0

  // Gráfico financeiro: receitas vs despesas por semana/dias
  const finChartData = useMemo(() => {
    const map: Record<string, { name: string; Receitas: number; Despesas: number }> = {}
    finTx.forEach(t => {
      const key = t.date?.slice(0, 7) // yyyy-MM
      if (!key) return
      if (!map[key]) map[key] = { name: key.slice(5) + '/' + key.slice(2,4), Receitas: 0, Despesas: 0 }
      if ((t.status === 'received' || t.status === 'paid')) {
        if (t.type === 'income')  map[key].Receitas += Number(t.amount)
        if (t.type === 'expense') map[key].Despesas += Number(t.amount)
      }
    })
    return Object.values(map).sort((a,b) => a.name.localeCompare(b.name))
  }, [finTx])

  // Categorias de despesas
  const expByCat = useMemo(() => {
    const map: Record<string, number> = {}
    finTx.filter(t => t.type === 'expense' && (t.status === 'paid' || t.status === 'received'))
      .forEach(t => { map[t.category] = (map[t.category] || 0) + Number(t.amount) })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
  }, [finTx])

  // Pedidos
  const ordersByStatus = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1 })
    return Object.entries(map).map(([status, count]) => ({
      name: (ORDER_STATUS as any)[status]?.label ?? status,
      value: count,
    }))
  }, [orders])

  const totalOrderValue = orders.reduce((s,o) => s + Number(o.total), 0)
  const ticketMedio     = orders.length > 0 ? totalOrderValue / orders.length : 0

  // Top clientes por pedidos
  const topClients = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {}
    orders.forEach(o => {
      const name = (o.customers as any)?.name ?? 'Sem cliente'
      if (!map[name]) map[name] = { name, count: 0, total: 0 }
      map[name].count++
      map[name].total += Number(o.total)
    })
    return Object.values(map).sort((a,b) => b.total - a.total).slice(0, 8)
  }, [orders])

  // Produtos
  const activeProducts = products.filter(p => p.is_active)
  const productsWithMargin = activeProducts
    .filter(p => Number(p.final_price) > 0)
    .map(p => ({
      name: String(p.name).slice(0, 22),
      margin: Number(p.total_cost) > 0
        ? ((Number(p.final_price) - Number(p.total_cost)) / Number(p.final_price) * 100)
        : 0,
      price: Number(p.final_price),
    }))
    .sort((a,b) => b.margin - a.margin)
    .slice(0, 8)

  // Estoque
  const criticalItems = inventory.filter(i => i.status === 'critical' || i.status === 'warning')
  const totalStockCost = inventory.reduce((s,i) => s + Number(i.cost_per_unit) * Number(i.quantity), 0)

  // Orçamentos
  const budgetConversion = budgets.length > 0
    ? (budgets.filter(b => b.status === 'approved' || b.status === 'converted').length / budgets.length * 100).toFixed(1)
    : '0'
  const totalBudgetValue = budgets.reduce((s,b) => s + Number(b.total), 0)

  const TABS = [
    { key: 'financeiro', label: 'Financeiro',  icon: DollarSign  },
    { key: 'pedidos',    label: 'Pedidos',      icon: ShoppingCart },
    { key: 'clientes',   label: 'Clientes',     icon: Users        },
    { key: 'produtos',   label: 'Produtos',     icon: Package      },
    { key: 'estoque',    label: 'Estoque',      icon: BarChart3    },
    { key: 'orcamentos', label: 'Orçamentos',   icon: FileText     },
  ] as const

  const tooltipStyle = {
    backgroundColor: '#1C1714',
    border: '1px solid rgba(139,108,79,0.3)',
    borderRadius: '10px',
    color: '#FAF7F4',
    fontSize: 12,
  }

  return (
    <div className="page-enter">
      <Header title="Relatórios" subtitle="Análises completas do seu negócio em tempo real" />

      <div className="p-3 sm:p-5 lg:p-6 space-y-5">

        {/* ── Filtro de período ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-primary-50 dark:bg-white/[0.04] flex-shrink-0 flex-wrap">
            {(Object.entries(PERIOD_LABELS) as [Period,string][]).map(([k,l]) => (
              <button key={k} onClick={() => setPeriod(k)}
                className={clsx('px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap',
                  period === k ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-text-muted dark:text-stone-500 hover:text-text-primary')}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-text-muted dark:text-stone-500">
              {start.split('-').reverse().join('/')} → {end.split('-').reverse().join('/')}
            </p>
            <button onClick={() => handleExportPDF('pdf')} disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity shadow-sm"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}>
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {exporting ? 'Gerando...' : 'Baixar PDF'}
            </button>
            <button onClick={() => handleExportPDF('print')} disabled={exporting}
              title="Imprimir relatório"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border dark:border-border-dark text-text-muted dark:text-stone-400 hover:border-primary hover:text-primary transition-all disabled:opacity-50">
              <Printer size={13} />
            </button>
          </div>
        </div>

        {/* ── Tabs de módulo ── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0',
                activeTab === key
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'border-border dark:border-border-dark text-text-muted dark:text-stone-400 hover:border-primary/50 hover:text-primary'
              )}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════
            TAB: FINANCEIRO
        ══════════════════════════════ */}
        {activeTab === 'financeiro' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI label="Receitas"     value={fmt(totalInc)} icon={TrendingUp}   color="text-green-500" sub={`${finTx.filter(t=>t.type==='income'&&(t.status==='received'||t.status==='paid')).length} lançamentos`} />
              <KPI label="Despesas"     value={fmt(totalExp)} icon={TrendingDown}  color="text-red-500"   sub={`${finTx.filter(t=>t.type==='expense'&&(t.status==='received'||t.status==='paid')).length} lançamentos`} />
              <KPI label="Saldo"        value={fmt(balance)}  icon={DollarSign}    color={balance>=0?'text-primary':'text-red-500'} sub={`Margem: ${margin.toFixed(1)}%`} />
              <KPI label="Pendentes"    value={fmt(finTx.filter(t=>['pending','to_pay'].includes(t.status??'')).reduce((s,t)=>s+Number(t.amount),0))} icon={Clock} color="text-amber-500" sub={`${finTx.filter(t=>['pending','to_pay'].includes(t.status??'')).length} a liquidar`} />
            </div>

            {finChartData.length > 0 && (
              <div className="card">
                <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-4">Receitas vs Despesas por período</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={finChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,108,79,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9a8a7a' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9a8a7a' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmt(v), '']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Receitas" fill="#5C8B4F" radius={[4,4,0,0]} />
                    <Bar dataKey="Despesas" fill="#EF4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {expByCat.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card">
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-4">Despesas por categoria</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={expByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {expByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmt(v), 'Valor']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="card space-y-2">
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Ranking de despesas</p>
                  {expByCat.slice(0,6).map((c,i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i%COLORS.length] }} />
                      <span className="text-xs text-text-secondary dark:text-stone-400 flex-1 truncate capitalize">{c.name}</span>
                      <span className="text-xs font-semibold text-text-primary dark:text-stone-100">{fmt(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {finTx.length === 0 && (
              <div className="card text-center py-12">
                <DollarSign size={32} className="mx-auto text-text-muted opacity-30 mb-3" />
                <p className="text-sm text-text-muted">Nenhuma transação no período</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: PEDIDOS
        ══════════════════════════════ */}
        {activeTab === 'pedidos' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI label="Total pedidos"   value={fmtN(orders.length)}          icon={ShoppingCart} />
              <KPI label="Valor total"     value={fmt(totalOrderValue)}           icon={DollarSign}   color="text-primary" />
              <KPI label="Ticket médio"    value={fmt(ticketMedio)}               icon={TrendingUp}   color="text-green-500" />
              <KPI label="Entregues"       value={fmtN(orders.filter(o=>o.status==='delivered').length)} icon={CheckCircle} color="text-green-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ordersByStatus.length > 0 && (
                <div className="card">
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-4">Pedidos por status</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={ordersByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                        label={({ name, value }: any) => `${name}: ${value}`} labelLine={false} fontSize={10}>
                        {ordersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card space-y-2">
                <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Status dos pedidos</p>
                {Object.entries(ORDER_STATUS).map(([key, cfg]) => {
                  const count = orders.filter(o => o.status === key).length
                  const pct   = orders.length > 0 ? (count/orders.length)*100 : 0
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary dark:text-stone-400">{cfg.label}</span>
                        <span className="font-semibold text-text-primary dark:text-stone-100">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-primary-50 dark:bg-white/5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {orders.length === 0 && (
              <div className="card text-center py-12">
                <ShoppingCart size={32} className="mx-auto text-text-muted opacity-30 mb-3" />
                <p className="text-sm text-text-muted">Nenhum pedido no período</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: CLIENTES
        ══════════════════════════════ */}
        {activeTab === 'clientes' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KPI label="Total clientes"    value={fmtN(customers.length)}      icon={Users}    />
              <KPI label="Com pedidos"       value={fmtN(new Set(orders.map(o=>(o.customers as any)?.name).filter(Boolean)).size)} icon={ShoppingCart} color="text-primary" />
              <KPI label="Ticket por cliente" value={fmt(customers.length > 0 ? totalOrderValue / (new Set(orders.map(o=>(o.customers as any)?.name).filter(Boolean)).size || 1) : 0)} icon={DollarSign} color="text-green-500" />
            </div>

            {topClients.length > 0 && (
              <div className="card">
                <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-4">Top clientes por valor (pedidos)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topClients} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,108,79,0.1)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9a8a7a' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#9a8a7a' }} width={90} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmt(v), 'Total']} />
                    <Bar dataKey="total" fill="#8B6C4F" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {topClients.length === 0 && (
              <div className="card text-center py-12">
                <Users size={32} className="mx-auto text-text-muted opacity-30 mb-3" />
                <p className="text-sm text-text-muted">Nenhum dado de clientes no período</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: PRODUTOS
        ══════════════════════════════ */}
        {activeTab === 'produtos' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI label="Ativos"       value={fmtN(activeProducts.length)}   icon={Package}    />
              <KPI label="Com margem"   value={fmtN(productsWithMargin.length)} icon={TrendingUp} color="text-green-500" />
              <KPI label="Margem média" value={productsWithMargin.length > 0 ? (productsWithMargin.reduce((s,p)=>s+p.margin,0)/productsWithMargin.length).toFixed(1)+'%' : '—'} icon={Star} color="text-primary" />
              <KPI label="Ticket médio" value={activeProducts.length > 0 ? fmt(activeProducts.reduce((s,p)=>s+Number(p.final_price),0)/activeProducts.length) : fmt(0)} icon={DollarSign} color="text-amber-500" />
            </div>

            {productsWithMargin.length > 0 && (
              <div className="card">
                <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-4">Margem de lucro por produto (%)</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={productsWithMargin} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,108,79,0.1)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9a8a7a' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#9a8a7a' }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Margem']} />
                    <Bar dataKey="margin" radius={[0,4,4,0]}>
                      {productsWithMargin.map((p, i) => (
                        <Cell key={i} fill={p.margin >= 40 ? '#5C8B4F' : p.margin >= 20 ? '#8B6C4F' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {products.length === 0 && (
              <div className="card text-center py-12">
                <Package size={32} className="mx-auto text-text-muted opacity-30 mb-3" />
                <p className="text-sm text-text-muted">Nenhum produto cadastrado</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: ESTOQUE
        ══════════════════════════════ */}
        {activeTab === 'estoque' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI label="Itens"        value={fmtN(inventory.length)}      icon={Package} />
              <KPI label="Críticos"     value={fmtN(inventory.filter(i=>i.status==='critical').length)} icon={AlertTriangle} color="text-red-500" />
              <KPI label="Em atenção"   value={fmtN(inventory.filter(i=>i.status==='warning').length)} icon={Clock} color="text-amber-500" />
              <KPI label="Valor total"  value={fmt(totalStockCost)} icon={DollarSign} color="text-primary" />
            </div>

            {criticalItems.length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-border dark:border-border-dark">
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Itens que precisam de atenção</p>
                </div>
                <div className="divide-y divide-border dark:divide-border-dark">
                  {criticalItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-4">
                      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', item.status==='critical' ? 'bg-red-500' : 'bg-amber-500')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                        <p className="text-xs text-text-muted">{item.category}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={clsx('text-sm font-bold', item.status==='critical' ? 'text-red-500' : 'text-amber-500')}>
                          {Number(item.quantity)} {item.unit}
                        </p>
                        <p className="text-[10px] text-text-muted">mín: {Number(item.minimum_quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inventory.length === 0 && (
              <div className="card text-center py-12">
                <BarChart3 size={32} className="mx-auto text-text-muted opacity-30 mb-3" />
                <p className="text-sm text-text-muted">Nenhum item no estoque</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: ORÇAMENTOS
        ══════════════════════════════ */}
        {activeTab === 'orcamentos' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI label="Total"         value={fmtN(budgets.length)}        icon={FileText} />
              <KPI label="Aprovados"     value={fmtN(budgets.filter(b=>b.status==='approved'||b.status==='converted').length)} icon={CheckCircle} color="text-green-500" />
              <KPI label="Conversão"     value={`${budgetConversion}%`}      icon={TrendingUp} color="text-primary" />
              <KPI label="Valor total"   value={fmt(totalBudgetValue)}       icon={DollarSign} color="text-amber-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {budgets.length > 0 && (
                <div className="card">
                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-4">Status dos orçamentos</p>
                  <div className="space-y-2">
                    {Object.entries(BUDGET_STATUS).map(([key, cfg]) => {
                      const count = budgets.filter(b => b.status === key).length
                      const pct   = budgets.length > 0 ? (count/budgets.length)*100 : 0
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-text-secondary dark:text-stone-400">{cfg.label}</span>
                            <span className="font-semibold text-text-primary dark:text-stone-100">{count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-primary-50 dark:bg-white/5">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="card space-y-3">
                <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Últimos orçamentos</p>
                {budgets.slice(0, 6).map(b => (
                  <div key={b.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-primary dark:text-stone-100 truncate">
                        {(b.customers as any)?.name ?? 'Sem cliente'}
                      </p>
                      <p className="text-[10px] text-text-muted">{(BUDGET_STATUS as any)[b.status]?.label ?? b.status}</p>
                    </div>
                    <p className="text-sm font-bold text-primary ml-2 flex-shrink-0">{fmt(b.total)}</p>
                  </div>
                ))}
                {budgets.length === 0 && <p className="text-xs text-text-muted text-center py-4">Sem orçamentos no período</p>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
