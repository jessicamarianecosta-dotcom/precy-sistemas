'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, ShoppingCart, AlertTriangle,
  Plus, ArrowRight, Package, DollarSign, BarChart3, Clock
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useDashboard } from '@/hooks/useDashboard'
import { Header } from '@/components/layout/Header'
import { SkeletonDashboard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { clsx } from 'clsx'
import Link from 'next/link'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const STATUS_COLORS = {
  pending: '#C4893A',
  production: '#3A7EC4',
  ready: '#5C8B4F',
  delivered: '#8B6C4F',
  cancelled: '#C4503A',
}

const STATUS_LABELS = {
  pending: 'Pendente',
  production: 'Produção',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export default function DashboardPage() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      if (profile) setUserName(profile.name?.split(' ')[0] || 'você')

      const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', user.id)
        .single()

      if (company) {
        setCompanyId(company.id)
        setCompanyName(company.name)
      }
    }
    load()
  }, [])

  const { data, isLoading, isError } = useDashboard(companyId)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const metricCards = [
    {
      label: 'Faturamento',
      value: formatCurrency(data?.revenue ?? 0),
      icon: TrendingUp,
      color: 'text-success',
      bg: 'bg-success-light dark:bg-success/10',
      description: 'Este mês',
    },
    {
      label: 'Lucro Líquido',
      value: formatCurrency(data?.profit ?? 0),
      icon: DollarSign,
      color: data?.profit && data.profit >= 0 ? 'text-success' : 'text-error',
      bg: data?.profit && data.profit >= 0 ? 'bg-success-light dark:bg-success/10' : 'bg-error-light dark:bg-error/10',
      description: 'Receita – despesas',
    },
    {
      label: 'Pedidos Ativos',
      value: String(data?.activeOrdersCount ?? 0),
      icon: ShoppingCart,
      color: 'text-info',
      bg: 'bg-info-light dark:bg-info/10',
      description: 'Em andamento',
    },
    {
      label: 'Estoque Crítico',
      value: String(data?.criticalStockCount ?? 0),
      icon: AlertTriangle,
      color: data?.criticalStockCount ? 'text-warning' : 'text-success',
      bg: data?.criticalStockCount ? 'bg-warning-light dark:bg-warning/10' : 'bg-success-light dark:bg-success/10',
      description: 'Itens em alerta',
    },
  ]

  const pieData = Object.entries(data?.ordersByStatus ?? {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: STATUS_LABELS[key as keyof typeof STATUS_LABELS],
      value,
      color: STATUS_COLORS[key as keyof typeof STATUS_COLORS],
    }))

  return (
    <div className="page-enter">
      <Header
        title={`${greeting}, ${userName}! 👋`}
        subtitle={companyName || 'Carregando...'}
      />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <SkeletonDashboard />
        ) : isError ? (
          <div className="card text-center py-12">
            <p className="text-error font-medium">Erro ao carregar dados. Tente novamente.</p>
          </div>
        ) : (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {metricCards.map((card) => {
                const Icon = card.icon
                return (
                  <div key={card.label} className="card card-hover group cursor-default">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-medium text-text-muted dark:text-stone-400 uppercase tracking-wider">
                          {card.label}
                        </p>
                      </div>
                      <div className={clsx('p-2 rounded-xl', card.bg)}>
                        <Icon size={18} className={card.color} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-text-primary dark:text-stone-100 mb-1">
                      {card.value}
                    </p>
                    <p className="text-xs text-text-muted dark:text-stone-500">{card.description}</p>
                  </div>
                )
              })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Area Chart */}
              <div className="lg:col-span-2 card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                      Receita vs Despesas
                    </h2>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">Evolução anual</p>
                  </div>
                  <BarChart3 size={18} className="text-primary" />
                </div>
                {data?.chartData && data.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={data.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B6C4F" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#8B6C4F" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C4503A" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#C4503A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,108,79,0.08)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#B8A898' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#B8A898' }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #EDE8E2',
                          borderRadius: '12px',
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [formatCurrency(v)]}
                      />
                      <Area type="monotone" dataKey="receita" stroke="#8B6C4F" strokeWidth={2} fill="url(#colorReceita)" name="Receita" />
                      <Area type="monotone" dataKey="despesas" stroke="#C4503A" strokeWidth={2} fill="url(#colorDespesas)" name="Despesas" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    icon={BarChart3}
                    title="Sem dados ainda"
                    description="Registre transações para ver o gráfico de evolução."
                  />
                )}
              </div>

              {/* Pedidos por Status */}
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                      Pedidos por Status
                    </h2>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-0.5">Visão geral</p>
                  </div>
                </div>
                {pieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2">
                      {pieData.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                            <span className="text-xs text-text-secondary dark:text-stone-400">{entry.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-text-primary dark:text-stone-200">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={ShoppingCart}
                    title="Sem pedidos"
                    description="Crie seu primeiro pedido para ver o gráfico."
                  />
                )}
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Últimos Pedidos */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                    Últimos Pedidos
                  </h2>
                  <Link href="/pedidos" className="text-xs text-primary hover:underline flex items-center gap-1">
                    Ver todos <ArrowRight size={12} />
                  </Link>
                </div>
                {data?.latestOrders && data.latestOrders.length > 0 ? (
                  <div className="space-y-3">
                    {data.latestOrders.map((order: Record<string, unknown>) => (
                      <div key={order.id as string} className="flex items-center gap-3 py-2 border-b border-border dark:border-border-dark last:border-0">
                        <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart size={15} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">
                            {(order.customers as Record<string, unknown>)?.name as string || 'Cliente'}
                          </p>
                          <p className="text-xs text-text-muted dark:text-stone-500">
                            {order.order_number as string}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100">
                            {formatCurrency(Number(order.total))}
                          </p>
                          <span className={clsx(
                            'badge text-[10px]',
                            order.status === 'pending' ? 'badge-warning' :
                            order.status === 'production' ? 'badge-info' :
                            order.status === 'ready' ? 'badge-success' : 'badge-primary'
                          )}>
                            {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ShoppingCart}
                    title="Nenhum pedido ainda"
                    description="Crie seu primeiro pedido agora."
                    action={{ label: '+ Novo pedido', onClick: () => {} }}
                  />
                )}
              </div>

              {/* Estoque Crítico */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                    Alertas de Estoque
                  </h2>
                  <Link href="/estoque" className="text-xs text-primary hover:underline flex items-center gap-1">
                    Ver estoque <ArrowRight size={12} />
                  </Link>
                </div>
                {data?.criticalStock && data.criticalStock.length > 0 ? (
                  <div className="space-y-3">
                    {data.criticalStock.map((item: Record<string, unknown>) => (
                      <div key={item.id as string} className="flex items-center gap-3 py-2 border-b border-border dark:border-border-dark last:border-0">
                        <div className={clsx(
                          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                          item.status === 'critical' ? 'bg-error-light dark:bg-error/10' : 'bg-warning-light dark:bg-warning/10'
                        )}>
                          <AlertTriangle size={15} className={item.status === 'critical' ? 'text-error' : 'text-warning'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{item.name as string}</p>
                          <p className="text-xs text-text-muted dark:text-stone-500">
                            {Number(item.quantity)} {item.unit as string} restantes
                          </p>
                        </div>
                        <span className={clsx('badge text-[10px]', item.status === 'critical' ? 'badge-error' : 'badge-warning')}>
                          {item.status === 'critical' ? 'Crítico' : 'Atenção'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state py-10">
                    <div className="w-12 h-12 rounded-xl bg-success-light flex items-center justify-center mx-auto mb-3">
                      <Package size={20} className="text-success" />
                    </div>
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100">Estoque saudável! 🎉</p>
                    <p className="text-xs text-text-muted dark:text-stone-400 mt-1">Nenhum item em nível crítico</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-4">Atalhos rápidos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { href: '/pedidos', icon: ShoppingCart, label: 'Novo Pedido', color: 'bg-info-light text-info-dark dark:bg-info/10 dark:text-info' },
                  { href: '/produtos', icon: Package, label: 'Novo Produto', color: 'bg-primary-50 text-primary dark:bg-primary/10' },
                  { href: '/orcamentos', icon: Clock, label: 'Orçamento', color: 'bg-warning-light text-warning-dark dark:bg-warning/10' },
                  { href: '/financeiro', icon: DollarSign, label: 'Transação', color: 'bg-success-light text-success-dark dark:bg-success/10' },
                ].map(item => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-border dark:border-border-dark hover:border-primary/40 hover:shadow-card-hover transition-all duration-200 group"
                    >
                      <div className={clsx('p-2 rounded-lg flex-shrink-0', item.color)}>
                        <Icon size={16} />
                      </div>
                      <span className="text-sm font-medium text-text-primary dark:text-stone-100 group-hover:text-primary transition-colors">
                        {item.label}
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
