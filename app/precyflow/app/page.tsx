'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { BarChart, Bar, XAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ShoppingCart, Wallet, Coins, BarChart3, Heart, Lightbulb } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchOrderReceivables } from '@/lib/orders/receivables'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { format, startOfDay, startOfMonth, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_LABELS: Record<string, string> = {
  pending:    'A confirmar',
  production: 'Em produção',
  ready:      'Pronto',
  delivered:  'Entregue',
}
const STATUS_ORDER = ['pending', 'production', 'ready', 'delivered']
const STATUS_COLORS: Record<string, string> = {
  pending: '#A7D8A7', production: '#F4A6C6', ready: '#F6D186', delivered: '#B9A6E0',
}

function useCompany() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: company } = await supabase.from('companies').select('id, name').eq('user_id', user.id).single() as any
      if (company) { setCompanyId(company.id); setCompanyName(company.name ?? '') }
    }
    load()
  }, [])
  return { companyId, companyName }
}

function usePrecyflowDashboard(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-dashboard', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) throw new Error('Empresa não encontrada')
      const now = new Date()
      const todayStart = startOfDay(now).toISOString()
      const monthStart = startOfMonth(now).toISOString()
      const weekStart = startOfWeek(now, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

      const [
        { count: pedidosHoje },
        { data: receivedTodayRows },
        { data: incomeMonthRows },
        { data: ordersByStatus },
        { data: recentOrders },
        { data: weekOrders },
      ] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).gte('created_at', todayStart) as any,
        supabase.from('payment_history').select('amount')
          .eq('company_id', companyId).eq('payment_date', format(now, 'yyyy-MM-dd')) as any,
        supabase.from('financial_transactions').select('amount')
          .eq('company_id', companyId).eq('type', 'income').gte('date', monthStart) as any,
        supabase.from('orders').select('status').eq('company_id', companyId) as any,
        supabase.from('orders')
          .select('id, order_number, total, status, created_at, customers(name)')
          .eq('company_id', companyId).order('created_at', { ascending: false }).limit(5) as any,
        supabase.from('orders').select('total, created_at')
          .eq('company_id', companyId)
          .gte('created_at', weekStart.toISOString()).lte('created_at', weekEnd.toISOString()) as any,
      ])

      const receivables = await fetchOrderReceivables(supabase, companyId)
      const aReceber = receivables.reduce((sum, r) => sum + (r.status === 'cancelado' ? 0 : r.balance), 0)

      const recebidoHoje = (receivedTodayRows ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const faturamentoMes = (incomeMonthRows ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)

      const statusCounts: Record<string, number> = { pending: 0, production: 0, ready: 0, delivered: 0 }
      for (const row of ordersByStatus ?? []) {
        if (statusCounts[row.status] !== undefined) statusCounts[row.status]++
      }

      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      const weeklyChart = weekDays.map(day => ({
        label: format(day, 'EEEEEE', { locale: ptBR }).replace('.', ''),
        total: (weekOrders ?? [])
          .filter((o: any) => isSameDay(new Date(o.created_at), day))
          .reduce((s: number, o: any) => s + Number(o.total), 0),
      }))

      return {
        pedidosHoje: pedidosHoje ?? 0,
        aReceber,
        recebidoHoje,
        faturamentoMes,
        statusCounts,
        recentOrders: recentOrders ?? [],
        weeklyChart,
      }
    },
  })
}

function Indicator({
  icon: Icon, label, value, bg, fg,
}: { icon: React.ElementType; label: string; value: string; bg: string; fg: string }) {
  return (
    <div className="pf-card p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
        <Icon size={20} style={{ color: fg }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--pf-text-secondary)' }}>{label}</p>
        <p className="text-lg font-bold truncate">{value}</p>
      </div>
    </div>
  )
}

export default function PrecyflowDashboardPage() {
  const { companyId, companyName } = useCompany()
  const { data, isLoading } = usePrecyflowDashboard(companyId)

  return (
    <div>
      <PrecyflowHeader title="Dashboard" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-6">
        <div className="relative overflow-hidden rounded-2xl">
          <div
            className="absolute -right-10 -top-16 w-72 h-72 rounded-full opacity-70 pointer-events-none"
            style={{ backgroundColor: 'var(--pf-primary-soft)' }}
            aria-hidden
          />
          <Heart size={28} className="absolute right-6 top-6 pf-text-primary-accent opacity-80" aria-hidden fill="currentColor" />
          <div className="relative py-2">
            <h2 className="text-lg font-bold flex items-center gap-1.5">
              Bom dia{companyName ? `, ${companyName.split(' ')[0]}` : ''}!
              <Heart size={16} className="pf-text-primary-accent" fill="currentColor" />
            </h2>
            <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
              Aqui está um resumo do seu negócio hoje.
            </p>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pf-card h-24 animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Indicator icon={ShoppingCart} label="Pedidos hoje" value={String(data.pedidosHoje)} bg="#FBE4EC" fg="#D6568C" />
              <Indicator icon={Wallet} label="A receber" value={formatCurrency(data.aReceber)} bg="#E3F3E3" fg="#5CA85C" />
              <Indicator icon={Coins} label="Recebido hoje" value={formatCurrency(data.recebidoHoje)} bg="#FDEFDD" fg="#D99A3F" />
              <Indicator icon={BarChart3} label="Faturamento do mês" value={formatCurrency(data.faturamentoMes)} bg="#EFE6FA" fg="#8E6FC2" />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="pf-card p-4">
                <p className="text-sm font-semibold mb-3">Vendas da semana</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.weeklyChart}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Bar dataKey="total" fill="var(--pf-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="pf-card p-4">
                <p className="text-sm font-semibold mb-3">Pedidos por status</p>
                <div className="flex items-center gap-4">
                  <div className="relative w-32 h-32 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={STATUS_ORDER.map(s => ({ name: STATUS_LABELS[s], value: data.statusCounts[s] ?? 0 }))}
                          dataKey="value" innerRadius={38} outerRadius={60} paddingAngle={3} stroke="none"
                        >
                          {STATUS_ORDER.map(s => <Cell key={s} fill={STATUS_COLORS[s]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold">
                        {STATUS_ORDER.reduce((s, k) => s + (data.statusCounts[k] ?? 0), 0)}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--pf-text-secondary)' }}>Pedidos</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {STATUS_ORDER.map(status => (
                      <div key={status} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
                        <span className="flex-1 truncate" style={{ color: 'var(--pf-text-secondary)' }}>{STATUS_LABELS[status]}</span>
                        <span className="font-semibold">{data.statusCounts[status] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pf-card p-4">
              <p className="text-sm font-semibold mb-3">Pedidos recentes</p>
              {data.recentOrders.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--pf-text-muted)' }}>
                  Nenhum pedido ainda.
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--pf-border)' }}>
                  {data.recentOrders.map((o: any) => (
                    <Link
                      key={o.id}
                      href={`/precyflow/app/pedidos/${o.id}`}
                      className="flex items-center justify-between py-2.5 text-sm hover:pf-bg-primary-soft rounded-lg px-2 -mx-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">Pedido #{o.order_number}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--pf-text-secondary)' }}>
                          {o.customers?.name ?? 'Cliente'} · {STATUS_LABELS[o.status] ?? o.status}
                        </p>
                      </div>
                      <span className="font-semibold flex-shrink-0">{formatCurrency(Number(o.total))}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="pf-card p-4 sm:p-5 flex items-center gap-4 overflow-hidden relative" style={{ backgroundColor: 'var(--pf-primary-soft)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--pf-surface)' }}>
                <Lightbulb size={20} className="text-warning" />
              </div>
              <div className="min-w-0 relative z-10">
                <p className="text-sm font-bold flex items-center gap-1.5">Dica do PrecyFlow <span>✨</span></p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--pf-text-secondary)' }}>
                  Mantenha seus produtos e materiais sempre atualizados para decisões mais precisas e lucrativas.
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/precyflow/mascote/gatinho-oficial.png" alt="" className="hidden sm:block w-20 h-20 object-contain flex-shrink-0 ml-auto" aria-hidden />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
