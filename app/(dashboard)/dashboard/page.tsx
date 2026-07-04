'use client'

import React, { useEffect, useState } from 'react'
import {
  TrendingUp, ShoppingCart, AlertTriangle,
  Package, DollarSign, BarChart3, Clock, Plus, Users,
  FileText, ArrowRight, CheckCircle, Zap, Activity,
  ChevronUp, ChevronDown, CalendarDays,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useDashboard }    from '@/hooks/useDashboard'
import { useSubscription } from '@/hooks/useSubscription'
import { Header } from '@/components/layout/Header'
import { SkeletonDashboard } from '@/components/ui/Skeleton'
import { clsx } from 'clsx'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils/format'

/* ─── Helpers ─── */
function fmt(v: number) {
  return formatCurrency(v)
}

function fmtPct(v: number | null) {
  if (v === null) return null
  const abs = Math.abs(v)
  return `${abs.toFixed(1)}%`
}

const STATUS_COLORS = {
  pending:    '#C4893A',
  production: '#3A7EC4',
  ready:      '#5C8B4F',
  delivered:  '#8B6C4F',
  cancelled:  '#C4503A',
}
const STATUS_LABELS = {
  pending:    'Pendente',
  production: 'Em Produção',
  ready:      'Pronto',
  delivered:  'Entregue',
  cancelled:  'Cancelado',
}
const STATUS_BADGE_CLASSES = {
  pending:    'badge-warning',
  production: 'badge-info',
  ready:      'badge-success',
  delivered:  'badge-primary',
  cancelled:  'badge-error',
}

/* ─── Delta indicator ─── */
function Delta({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-[10px] text-text-muted dark:text-stone-500">—</span>
  const up = value >= 0
  return (
    <span className={clsx(
      'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
      up
        ? 'bg-success-light dark:bg-success/15 text-success-dark'
        : 'bg-error-light dark:bg-error/15 text-error-dark'
    )}>
      {up ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
      {fmtPct(value)}{suffix}
    </span>
  )
}

/* ─── Custom tooltip for recharts ─── */
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#2A2220] border border-border dark:border-border-dark rounded-xl px-3 py-2.5 shadow-modal text-xs">
      <p className="font-semibold text-text-primary dark:text-stone-100 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-text-secondary dark:text-stone-400">{p.name}:</span>
          <span className="font-medium text-text-primary dark:text-stone-100">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════ PAGE ═══ */
export default function DashboardPage() {
  const supabase = createClient()
  const [companyId,   setCompanyId]   = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [userName,    setUserName]    = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Profile name → first word, fallback to email prefix
      const { data: profile } = await supabase
        .from('profiles').select('name').eq('id', user.id).single() as any
      const rawName: string = (profile as any)?.name ?? user.email?.split('@')[0] ?? 'Usuária'
      setUserName(rawName.split(' ')[0])

      const { data: company } = await supabase
        .from('companies').select('id, name').eq('user_id', user.id).single() as any
      if (company) {
        setCompanyId((company as any).id)
        setCompanyName((company as any).name ?? '')
      }
    }
    load()
  }, [])

  const { data, isLoading, isError } = useDashboard(companyId)
  const { data: sub }                = useSubscription()

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  /* ── Metric cards ── */
  const metricCards = [
    {
      label: 'Faturamento',
      value: fmt(data?.revenue ?? 0),
      delta: data?.revenueDelta ?? null,
      icon:  TrendingUp,
      color: 'text-success',
      bg:    'bg-success-light dark:bg-success/10',
      sub:   'Este mês',
      glow:  'hover:shadow-[0_0_20px_rgba(92,139,79,0.15)]',
    },
    {
      label: 'Lucro Líquido',
      value: fmt(data?.profit ?? 0),
      delta: data?.profitDelta ?? null,
      icon:  DollarSign,
      color: (data?.profit ?? 0) >= 0 ? 'text-success' : 'text-error',
      bg:    (data?.profit ?? 0) >= 0 ? 'bg-success-light dark:bg-success/10' : 'bg-error-light dark:bg-error/10',
      sub:   'Receita – despesas',
      glow:  'hover:shadow-[0_0_20px_rgba(92,139,79,0.12)]',
    },
    {
      label: 'Pedidos Ativos',
      value: String(data?.activeOrdersCount ?? 0),
      delta: null,
      icon:  ShoppingCart,
      color: 'text-info',
      bg:    'bg-info-light dark:bg-info/10',
      sub:   'Em andamento',
      glow:  'hover:shadow-[0_0_20px_rgba(58,126,196,0.15)]',
    },
    {
      label: 'Estoque Crítico',
      value: String(data?.criticalStockCount ?? 0),
      delta: null,
      icon:  AlertTriangle,
      color: (data?.criticalStockCount ?? 0) > 0 ? 'text-warning' : 'text-success',
      bg:    (data?.criticalStockCount ?? 0) > 0 ? 'bg-warning-light dark:bg-warning/10' : 'bg-success-light dark:bg-success/10',
      sub:   'Itens em alerta',
      glow:  'hover:shadow-[0_0_20px_rgba(196,137,58,0.15)]',
    },
  ]

  /* ── Pie data (orders by status) ── */
  const pieData = data?.ordersByStatus
    ? Object.entries(data.ordersByStatus)
        .filter(([, v]) => Number(v) > 0)
        .map(([key, value]) => ({
          name:  STATUS_LABELS[key as keyof typeof STATUS_LABELS],
          value: Number(value),
          color: STATUS_COLORS[key as keyof typeof STATUS_COLORS],
        }))
    : []

  /* ── Inventory donut ── */
  const invData = data?.inventoryCounts
    ? [
        { name: 'Saudável',  value: data.inventoryCounts.healthy,   color: '#5C8B4F' },
        { name: 'Atenção',   value: data.inventoryCounts.attention, color: '#C4893A' },
        { name: 'Crítico',   value: data.inventoryCounts.critical,  color: '#C4503A' },
      ].filter(d => d.value > 0)
    : []

  /* ── Alerts ── */
  const alerts: Array<{ level: 'error' | 'warning' | 'info' | 'success'; icon: React.ElementType; label: string; count: number; href: string }> = []
  if ((data?.criticalStockCount ?? 0) > 0) {
    const critical = data!.criticalStock.filter((i: any) => i.status === 'critical').length
    const attention= data!.criticalStock.filter((i: any) => i.status === 'attention').length
    if (critical  > 0) alerts.push({ level: 'error',   icon: AlertTriangle, label: 'Estoque crítico (zerado)',  count: critical,   href: '/estoque' })
    if (attention > 0) alerts.push({ level: 'warning',  icon: AlertTriangle, label: 'Estoque abaixo do mínimo', count: attention,  href: '/estoque' })
  }
  if ((data?.overdueOrdersCount ?? 0) > 0) {
    alerts.push({ level: 'error', icon: Clock, label: 'Pedidos com prazo vencido', count: data!.overdueOrdersCount, href: '/pedidos' })
  }
  if ((data?.pendingBudgetsCount ?? 0) > 0) {
    alerts.push({ level: 'info', icon: FileText, label: 'Orçamentos aguardando resposta', count: data!.pendingBudgetsCount, href: '/orcamentos' })
  }
  if ((data?.installmentsOverdueCount ?? 0) > 0) {
    alerts.push({ level: 'error', icon: Clock, label: 'Parcelas em atraso', count: data!.installmentsOverdueCount, href: '/financeiro' })
  }

  const alertBgClasses = {
    error:   'bg-error-light dark:bg-error/10 border-error/30',
    warning: 'bg-warning-light dark:bg-warning/10 border-warning/30',
    info:    'bg-info-light dark:bg-info/10 border-info/30',
    success: 'bg-success-light dark:bg-success/10 border-success/30',
  }
  const alertIconClasses = {
    error:   'text-error',
    warning: 'text-warning',
    info:    'text-info',
    success: 'text-success',
  }
  const alertTextClasses = {
    error:   'text-error-dark',
    warning: 'text-warning-dark',
    info:    'text-info-dark',
    success: 'text-success-dark',
  }

  /* ── Today's events (card Agenda de Hoje) ── */
  const todayStr = new Date().toISOString().split('T')[0]
  const next7Str  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const [todayTasks,   setTodayTasks]   = useState<any[]>([])
  const [todayOrders,  setTodayOrders]  = useState<any[]>([])
  const [pendingFin,   setPendingFin]   = useState<any[]>([])
  const [next7Orders,  setNext7Orders]  = useState<any[]>([])
  const [next7Tasks,   setNext7Tasks]   = useState<any[]>([])

  useEffect(() => {
    if (!companyId) return
    async function loadToday() {
      // Tarefas do dia
      const { data: tasks } = await (supabase.from('calendar_tasks') as any)
        .select('id, title, time, category, status, priority')
        .eq('company_id', companyId).eq('date', todayStr).neq('status', 'done').order('time')
      setTodayTasks(tasks ?? [])

      // Pedidos com entrega hoje
      const { data: orders } = await (supabase.from('orders') as any)
        .select('id, order_number, service_name, status, total, due_date, priority, customers(name)')
        .eq('company_id', companyId)
        .gte('due_date', todayStr + 'T00:00:00')
        .lte('due_date', todayStr + 'T23:59:59')
        .not('due_date', 'is', null)
      setTodayOrders(orders ?? [])

      // Transações financeiras pendentes (today and overdue)
      const { data: fin } = await (supabase.from('financial_transactions') as any)
        .select('id, type, category, amount, description, date, status, client_name')
        .eq('company_id', companyId)
        .in('status', ['pending', 'to_pay', 'overdue', 'due'])
        .lte('date', todayStr)
        .order('date', { ascending: true })
        .limit(5)
      setPendingFin(fin ?? [])

      // Próximos 7 dias — pedidos
      const { data: n7o } = await (supabase.from('orders') as any)
        .select('id, order_number, service_name, status, due_date, priority, customers(name)')
        .eq('company_id', companyId)
        .gt('due_date', todayStr + 'T23:59:59')
        .lte('due_date', next7Str + 'T23:59:59')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(5)
      setNext7Orders(n7o ?? [])

      // Próximos 7 dias — tarefas
      const { data: n7t } = await (supabase.from('calendar_tasks') as any)
        .select('id, title, date, time, category, priority')
        .eq('company_id', companyId)
        .gt('date', todayStr).lte('date', next7Str).neq('status', 'done')
        .order('date').order('time').limit(5)
      setNext7Tasks(n7t ?? [])
    }
    loadToday()
  }, [companyId, todayStr, next7Str])

  /* ── Quick actions ── */
  const quickActions = [
    { href: '/pedidos',     icon: ShoppingCart, label: 'Novo Pedido',     color: 'bg-info-light dark:bg-info/10 text-info-dark dark:text-info' },
    { href: '/orcamentos',  icon: FileText,     label: 'Novo Orçamento',  color: 'bg-warning-light dark:bg-warning/10 text-warning-dark dark:text-warning' },
    { href: '/clientes',    icon: Users,        label: 'Novo Cliente',    color: 'bg-primary-50 dark:bg-primary/10 text-primary' },
    { href: '/produtos',    icon: Package,      label: 'Novo Produto',    color: 'bg-success-light dark:bg-success/10 text-success-dark dark:text-success' },
  ]

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="page-enter">
      <Header
        title={`${greeting}, ${userName || 'Usuária'}! 👋`}
        subtitle={companyName || 'Carregando...'}
      />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">

        {/* ── Banner past_due ── */}
        {sub?.status === 'past_due' && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-red-200/50 dark:border-red-700/30 bg-red-50/50 dark:bg-red-900/10 flex-wrap">
            <p className="text-sm text-red-700 dark:text-red-400">
              ⚠️ <strong>Pagamento pendente.</strong> Renove para manter o acesso.
            </p>
            <a href="/assinatura/upgrade"
              className="text-xs font-bold text-white px-4 py-2 rounded-lg flex-shrink-0 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}>
              Renovar agora
            </a>
          </div>
        )}
        {isLoading ? (
          <SkeletonDashboard />
        ) : isError ? (
          <div className="card text-center py-12">
            <AlertTriangle size={28} className="text-error mx-auto mb-3" />
            <p className="text-error font-medium text-sm">Erro ao carregar dados. Tente novamente.</p>
          </div>
        ) : (
          <>
            {/* ─── ONBOARDING — aparece apenas quando sistema está zerado ─── */}
            {(data?.revenue ?? 0) === 0 &&
             (data?.activeOrdersCount ?? 0) === 0 && (
              <div className="rounded-2xl border border-primary/25 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(139,108,79,0.07), rgba(184,149,106,0.04))' }}>
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-xl">🚀</div>
                    <div>
                      <p className="text-sm font-bold text-text-primary dark:text-stone-100">Bem-vinda ao Precy+!</p>
                      <p className="text-xs text-text-secondary dark:text-stone-400 mt-0.5 leading-relaxed">
                        Configure os 4 passos abaixo para começar a usar todos os recursos do sistema.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { step: '1', title: 'Configure sua empresa',   desc: 'Nome, logo e dados do negócio', href: '/configuracoes', done: !!companyName },
                      { step: '2', title: 'Adicione seus materiais', desc: 'Cadastre materiais no estoque',  href: '/estoque',       done: false },
                      { step: '3', title: 'Crie seu primeiro produto', desc: 'Precifique com inteligência', href: '/precificacao',   done: false },
                      { step: '4', title: 'Registre seu primeiro pedido', desc: 'Gerencie sua produção',    href: '/pedidos',        done: false },
                    ].map(s => (
                      <a key={s.step} href={s.href}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-surface-dark border border-border dark:border-border-dark hover:border-primary/40 hover:shadow-sm transition-all group">
                        <div className={clsx(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                          s.done
                            ? 'bg-success text-white'
                            : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all'
                        )}>
                          {s.done ? '✓' : s.step}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary dark:text-stone-100 truncate">{s.title}</p>
                          <p className="text-[10px] text-text-muted dark:text-stone-400 truncate">{s.desc}</p>
                        </div>
                        <ArrowRight size={12} className="text-text-muted group-hover:text-primary transition-colors flex-shrink-0 ml-auto" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── METRIC CARDS ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {metricCards.map(card => {
                const Icon = card.icon
                return (
                  <div
                    key={card.label}
                    className={clsx(
                      'card card-hover group cursor-default transition-all duration-300',
                      card.glow
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-[10px] sm:text-xs font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider">
                        {card.label}
                      </p>
                      <div className={clsx('p-1.5 sm:p-2 rounded-xl transition-transform duration-200 group-hover:scale-110', card.bg)}>
                        <Icon size={15} className={card.color} />
                      </div>
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-text-primary dark:text-stone-100 mb-1.5 leading-none">
                      {card.value}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[10px] text-text-muted dark:text-stone-500">{card.sub}</p>
                      {card.delta !== null && <Delta value={card.delta} />}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ─── ALERTAS ─── */}
            {alerts.length > 0 && (
              <div className="card p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={15} className="text-primary" />
                  <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                    Alertas do sistema
                  </h2>
                  <span className="ml-auto badge badge-error text-[10px]">
                    {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {alerts.map(alert => {
                    const Icon = alert.icon
                    return (
                      <Link
                        key={alert.label}
                        href={alert.href}
                        className={clsx(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5',
                          alertBgClasses[alert.level]
                        )}
                      >
                        <Icon size={15} className={clsx('flex-shrink-0', alertIconClasses[alert.level])} />
                        <span className={clsx('text-xs font-medium flex-1', alertTextClasses[alert.level])}>
                          {alert.label}
                        </span>
                        <span className={clsx(
                          'text-xs font-bold px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20',
                          alertTextClasses[alert.level]
                        )}>
                          {alert.count}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ─── PARCELAS A VENCER ─── */}
            {((data?.installmentsDueTodayCount ?? 0) + (data?.installmentsDueWeekCount ?? 0) + (data?.installmentsDueMonthCount ?? 0) + (data?.installmentsOverdueCount ?? 0)) > 0 && (
              <div className="card p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={15} className="text-primary" />
                  <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Parcelas a vencer</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'Hoje',      count: data?.installmentsDueTodayCount ?? 0, sum: data?.installmentsDueTodaySum ?? 0 },
                    { label: 'Esta semana', count: data?.installmentsDueWeekCount ?? 0, sum: data?.installmentsDueWeekSum ?? 0 },
                    { label: 'Este mês',  count: data?.installmentsDueMonthCount ?? 0, sum: data?.installmentsDueMonthSum ?? 0 },
                    { label: 'Atrasadas', count: data?.installmentsOverdueCount ?? 0, sum: data?.installmentsOverdueSum ?? 0, danger: true },
                  ].map(item => (
                    <Link key={item.label} href="/financeiro"
                      className={clsx('rounded-xl border p-3 transition-all hover:-translate-y-0.5',
                        item.danger && item.count > 0
                          ? 'bg-error-light dark:bg-error/10 border-error/30'
                          : 'bg-stone-50 dark:bg-stone-800/50 border-border dark:border-border-dark')}>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">{item.label}</p>
                      <p className={clsx('text-sm font-bold', item.danger && item.count > 0 ? 'text-error dark:text-red-400' : 'text-text-primary dark:text-stone-100')}>
                        {item.count}
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">{formatCurrency(item.sum)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ─── CHARTS ROW 1: Financeiro + Pedidos ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Area chart — 6 meses */}
              <div className="lg:col-span-2 card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                      Receita vs Despesas
                    </h2>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">Últimos 6 meses</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1 text-text-muted dark:text-stone-400">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                      Receita
                    </span>
                    <span className="flex items-center gap-1 text-text-muted dark:text-stone-400">
                      <span className="w-2 h-2 rounded-full bg-error inline-block" />
                      Despesas
                    </span>
                    <span className="flex items-center gap-1 text-text-muted dark:text-stone-400">
                      <span className="w-2 h-2 rounded-full bg-success inline-block" />
                      Lucro
                    </span>
                  </div>
                </div>
                {data?.chartData && data.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        {[
                          { id: 'receita',  color: '#8B6C4F' },
                          { id: 'despesas', color: '#C4503A' },
                          { id: 'lucro',    color: '#5C8B4F' },
                        ].map(g => (
                          <linearGradient key={g.id} id={`grad-${g.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={g.color} stopOpacity={0.18} />
                            <stop offset="100%" stopColor={g.color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,108,79,0.08)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#B8A898' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#B8A898' }} axisLine={false} tickLine={false}
                        tickFormatter={v => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="receita"  stroke="#8B6C4F" strokeWidth={2} fill="url(#grad-receita)"  name="Receita" />
                      <Area type="monotone" dataKey="despesas" stroke="#C4503A" strokeWidth={2} fill="url(#grad-despesas)" name="Despesas" />
                      <Area type="monotone" dataKey="lucro"    stroke="#5C8B4F" strokeWidth={2} fill="url(#grad-lucro)"    name="Lucro" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center mb-3">
                      <BarChart3 size={20} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100">Sem transações ainda</p>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-1 max-w-[200px]">
                      Registre receitas e despesas para ver a evolução financeira.
                    </p>
                    <Link href="/financeiro" className="mt-3 text-xs text-primary hover:underline font-medium">
                      Registrar transação →
                    </Link>
                  </div>
                )}
              </div>

              {/* Pie — pedidos por status */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Pedidos</h2>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">Por status</p>
                  </div>
                  <Link href="/pedidos" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    Ver todos <ArrowRight size={10} />
                  </Link>
                </div>
                {pieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={60} paddingAngle={3} dataKey="value">
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [v, 'pedidos']} contentStyle={{ borderRadius: '12px', fontSize: 11, border: '1px solid rgba(139,108,79,0.15)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1">
                      {pieData.map(e => (
                        <div key={e.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-text-secondary dark:text-stone-400">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                            {e.name}
                          </span>
                          <span className="font-semibold text-text-primary dark:text-stone-100">{e.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 rounded-xl bg-info-light dark:bg-info/10 flex items-center justify-center mb-2">
                      <ShoppingCart size={18} className="text-info" />
                    </div>
                    <p className="text-xs font-medium text-text-primary dark:text-stone-100">Sem pedidos ainda</p>
                    <Link href="/pedidos" className="mt-2 text-xs text-primary hover:underline">Criar pedido →</Link>
                  </div>
                )}
              </div>
            </div>

            {/* ─── CHARTS ROW 2: Barra Pedidos + Estoque Donut ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Bar chart — pedidos */}
              <div className="lg:col-span-2 card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Volume de Pedidos</h2>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">Por status (total acumulado)</p>
                  </div>
                </div>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={pieData}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                      barSize={28}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,108,79,0.08)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#B8A898' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#B8A898' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(139,108,79,0.05)' }}
                        formatter={(v: number) => [v, 'pedidos']}
                        contentStyle={{ borderRadius: '12px', fontSize: 11 }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[180px] flex items-center justify-center">
                    <p className="text-xs text-text-muted dark:text-stone-400">Nenhum pedido registrado.</p>
                  </div>
                )}
              </div>

              {/* Donut — estoque */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Estoque</h2>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">Por saúde dos itens</p>
                  </div>
                  <Link href="/estoque" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    Gerenciar <ArrowRight size={10} />
                  </Link>
                </div>
                {invData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={130}>
                      <PieChart>
                        <Pie data={invData} cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={3} dataKey="value">
                          {invData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [v, 'itens']} contentStyle={{ borderRadius: '12px', fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1">
                      {invData.map(e => (
                        <div key={e.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-text-secondary dark:text-stone-400">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                            {e.name}
                          </span>
                          <span className="font-semibold text-text-primary dark:text-stone-100">{e.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[180px] flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 rounded-xl bg-success-light dark:bg-success/10 flex items-center justify-center mb-2">
                      <Package size={18} className="text-success" />
                    </div>
                    <p className="text-xs font-medium text-text-primary dark:text-stone-100">Estoque vazio</p>
                    <Link href="/estoque" className="mt-2 text-xs text-primary hover:underline">Cadastrar itens →</Link>
                  </div>
                )}
              </div>
            </div>

            {/* ─── ÚLTIMAS ATIVIDADES + ESTOQUE CRÍTICO ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Últimas atividades (pedidos recentes) */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Últimas Atividades</h2>
                  </div>
                  <Link href="/pedidos" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    Ver todos <ArrowRight size={10} />
                  </Link>
                </div>
                {data?.latestOrders && data.latestOrders.length > 0 ? (
                  <div className="space-y-2.5">
                    {data.latestOrders.slice(0, 6).map((order: any) => (
                      <div
                        key={order.id}
                        className="flex items-center gap-3 py-2 border-b border-border dark:border-border-dark last:border-0"
                      >
                        <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart size={13} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-text-primary dark:text-stone-100 truncate">
                            {order.customers?.name ?? 'Cliente'}
                          </p>
                          <p className="text-[10px] text-text-muted dark:text-stone-500">
                            {order.order_number} · {format(new Date(order.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-primary">{fmt(Number(order.total))}</p>
                          <span className={clsx(
                            'badge text-[9px] mt-0.5',
                            STATUS_BADGE_CLASSES[order.status as keyof typeof STATUS_BADGE_CLASSES] ?? 'badge-primary'
                          )}>
                            {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] ?? order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center mb-3">
                      <ShoppingCart size={20} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                      Nenhum pedido cadastrado
                    </p>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-1 max-w-[180px]">
                      Crie seu primeiro pedido para ver as atividades aqui.
                    </p>
                    <Link href="/pedidos" className="mt-3 btn-primary text-xs py-2 px-4">
                      + Novo pedido
                    </Link>
                  </div>
                )}
              </div>

              {/* Estoque crítico / Alertas detalhados */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-warning" />
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Alertas de Estoque</h2>
                  </div>
                  <Link href="/estoque" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    Ver estoque <ArrowRight size={10} />
                  </Link>
                </div>
                {data?.criticalStock && data.criticalStock.length > 0 ? (
                  <div className="space-y-2.5">
                    {data.criticalStock.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 border-b border-border dark:border-border-dark last:border-0"
                      >
                        <div className={clsx(
                          'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                          item.status === 'critical' ? 'bg-error-light dark:bg-error/10' : 'bg-warning-light dark:bg-warning/10'
                        )}>
                          <AlertTriangle size={13} className={item.status === 'critical' ? 'text-error' : 'text-warning'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                          <p className="text-[10px] text-text-muted dark:text-stone-500">
                            {Number(item.quantity)} {item.unit} restantes · mín. {Number(item.minimum_quantity)}
                          </p>
                        </div>
                        <span className={clsx('badge text-[9px]', item.status === 'critical' ? 'badge-error' : 'badge-warning')}>
                          {item.status === 'critical' ? 'Crítico' : 'Atenção'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-success-light dark:bg-success/10 flex items-center justify-center mb-3">
                      <CheckCircle size={20} className="text-success" />
                    </div>
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                      Estoque saudável! 🎉
                    </p>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-1">
                      Nenhum item em nível crítico ou de atenção.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── AGENDA DE HOJE ─── */}
            {((todayTasks?.length ?? 0) + (todayOrders?.length ?? 0) + (pendingFin?.length ?? 0) > 0) && (
              <div className="card space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100 capitalize">
                      {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h2>
                  </div>
                  <Link href="/agenda" className="text-xs text-primary hover:underline">Ver agenda →</Link>
                </div>

                {/* Contadores de resumo */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={clsx(
                    'flex flex-col items-center justify-center p-2 rounded-xl text-center',
                    todayOrders.length > 0 ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/20' : 'bg-primary-50/30 dark:bg-white/[0.02] border border-border dark:border-border-dark'
                  )}>
                    <span className={clsx('text-lg font-bold', todayOrders.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted')}>
                      {todayOrders.length}
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5">Entregas</span>
                  </div>
                  <div className={clsx(
                    'flex flex-col items-center justify-center p-2 rounded-xl text-center',
                    todayTasks.length > 0 ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-800/20' : 'bg-primary-50/30 dark:bg-white/[0.02] border border-border dark:border-border-dark'
                  )}>
                    <span className={clsx('text-lg font-bold', todayTasks.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-text-muted')}>
                      {todayTasks.length}
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5">Tarefas</span>
                  </div>
                  <div className={clsx(
                    'flex flex-col items-center justify-center p-2 rounded-xl text-center',
                    pendingFin.length > 0 ? 'bg-red-50 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/20' : 'bg-primary-50/30 dark:bg-white/[0.02] border border-border dark:border-border-dark'
                  )}>
                    <span className={clsx('text-lg font-bold', pendingFin.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-text-muted')}>
                      {pendingFin.length}
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5">Pendentes</span>
                  </div>
                </div>

                {/* Lista de eventos do dia */}
                <div className="space-y-1.5">
                  {/* Pedidos com entrega hoje */}
                  {(todayOrders ?? []).map((o: any) => (
                    <Link key={o.id} href="/pedidos"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border dark:border-border-dark hover:border-primary/40 hover:bg-primary-50/30 dark:hover:bg-primary/5 transition-all group">
                      <div className={clsx('w-1 self-stretch rounded-full flex-shrink-0',
                        o.status === 'production' ? 'bg-blue-400' : o.status === 'ready' ? 'bg-green-400' : 'bg-amber-400'
                      )} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            📦 ENTREGA
                          </span>
                          {o.priority === 'urgent' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">URGENTE</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">
                          {o.service_name || 'Pedido'}
                        </p>
                        <p className="text-[11px] text-text-muted">{o.customers?.name ?? '—'} · {o.order_number || ''}</p>
                      </div>
                      <span className="text-sm font-bold text-primary flex-shrink-0">
                        {fmt(Number(o.total))}
                      </span>
                    </Link>
                  ))}

                  {/* Tarefas do dia */}
                  {(todayTasks ?? []).slice(0, 4).map((t: any) => (
                    <Link key={t.id} href="/agenda"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border dark:border-border-dark hover:border-primary/40 hover:bg-primary-50/30 dark:hover:bg-primary/5 transition-all">
                      <div className={clsx('w-1 self-stretch rounded-full flex-shrink-0',
                        t.priority === 'urgent' ? 'bg-red-400' : t.priority === 'high' ? 'bg-amber-400' : 'bg-blue-400'
                      )} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            📌 TAREFA
                          </span>
                          {t.priority === 'urgent' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">URGENTE</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{t.title}</p>
                        <p className="text-[11px] text-text-muted">{t.time ? t.time.slice(0, 5) + ' h' : 'Sem horário'}</p>
                      </div>
                    </Link>
                  ))}

                  {/* Financeiro pendente */}
                  {(pendingFin ?? []).map((f: any) => (
                    <Link key={f.id} href="/financeiro"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border dark:border-border-dark hover:border-red-400/40 hover:bg-red-50/30 dark:hover:bg-red-900/5 transition-all">
                      <div className="w-1 self-stretch rounded-full flex-shrink-0 bg-red-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={clsx(
                            'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                            f.status === 'overdue' || f.status === 'due'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          )}>
                            💰 {f.type === 'income' ? 'RECEBER' : 'PAGAR'}
                          </span>
                          {(f.status === 'overdue' || f.status === 'due') && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">VENCIDO</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">
                          {f.description || (f.type === 'income' ? 'Receita' : 'Despesa')}
                        </p>
                        {f.client_name && (
                          <p className="text-[11px] text-text-muted">{f.client_name}</p>
                        )}
                      </div>
                      <span className={clsx(
                        'text-sm font-bold flex-shrink-0',
                        f.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        {fmt(Number(f.amount))}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ─── PRÓXIMOS 7 DIAS ─── */}
            {((next7Orders?.length ?? 0) + (next7Tasks?.length ?? 0) > 0) && (
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-text-muted" />
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                      Próximos 7 dias
                    </h2>
                  </div>
                  <Link href="/agenda" className="text-xs text-primary hover:underline">Ver tudo →</Link>
                </div>
                <div className="space-y-1">
                  {[...((next7Orders ?? []).map((o: any) => ({
                    id: o.id, date: o.due_date?.split('T')[0], type: 'order',
                    title: o.service_name || 'Pedido', sub: o.customers?.name ?? '—', href: '/pedidos',
                    priority: o.priority, badge: '📦', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }))),
                  ...((next7Tasks ?? []).map((t: any) => ({
                    id: t.id, date: t.date, type: 'task',
                    title: t.title, sub: t.time ? t.time.slice(0,5)+' h' : '', href: '/agenda',
                    priority: t.priority, badge: '📌', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  })))]
                    .sort((a, b) => (a.date ?? '') > (b.date ?? '') ? 1 : -1)
                    .slice(0, 6)
                    .map(item => (
                      <Link key={`${item.type}-${item.id}`} href={item.href}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-primary-50/30 dark:hover:bg-primary/5 transition-all">
                        <div className="w-8 text-center flex-shrink-0">
                          <p className="text-[10px] font-bold text-text-muted uppercase">
                            {item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.','') : '—'}
                          </p>
                        </div>
                        <div className="w-px h-8 bg-border dark:bg-border-dark flex-shrink-0" />
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0', item.badgeColor)}>
                            {item.badge}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-text-primary dark:text-stone-100 truncate">{item.title}</p>
                            {item.sub && <p className="text-[10px] text-text-muted truncate">{item.sub}</p>}
                          </div>
                        </div>
                        {item.priority === 'urgent' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex-shrink-0">!</span>
                        )}
                      </Link>
                    ))
                  }
                </div>
              </div>
            )}

            {/* ─── AÇÕES RÁPIDAS ─── */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={15} className="text-primary" />
                <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Ações Rápidas</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {quickActions.map(action => {
                  const Icon = action.icon
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="group flex items-center gap-2.5 p-3.5 rounded-xl border border-border dark:border-border-dark hover:border-primary/50 hover:shadow-card-hover transition-all duration-200"
                    >
                      <div className={clsx('p-2 rounded-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-110', action.color)}>
                        <Icon size={15} />
                      </div>
                      <span className="text-xs font-medium text-text-primary dark:text-stone-100 group-hover:text-primary transition-colors leading-tight">
                        {action.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
