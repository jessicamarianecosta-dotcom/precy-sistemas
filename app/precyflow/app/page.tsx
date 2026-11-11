'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts'
import { ShoppingCart, Clock, CheckCircle2, Wallet } from 'lucide-react'
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

function Indicator({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="pf-card p-4">
      <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--pf-text-secondary)' }}>
        <Icon size={15} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
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
        <div>
          <h2 className="text-lg font-bold">Bom dia{companyName ? `, ${companyName}` : ''}!</h2>
          <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
            Aqui está um resumo do seu negócio hoje.
          </p>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pf-card h-24 animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Indicator icon={ShoppingCart} label="Pedidos hoje" value={String(data.pedidosHoje)} />
              <Indicator icon={Clock} label="A receber" value={formatCurrency(data.aReceber)} />
              <Indicator icon={Wallet} label="Recebido hoje" value={formatCurrency(data.recebidoHoje)} />
              <Indicator icon={CheckCircle2} label="Faturamento do mês" value={formatCurrency(data.faturamentoMes)} />
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
                <div className="space-y-2.5">
                  {STATUS_ORDER.map(status => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--pf-text-secondary)' }}>{STATUS_LABELS[status]}</span>
                      <span className="font-semibold">{data.statusCounts[status] ?? 0}</span>
                    </div>
                  ))}
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
          </>
        )}
      </div>
    </div>
  )
}
