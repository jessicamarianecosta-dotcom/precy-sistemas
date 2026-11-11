'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

type Period = 'month' | 'last_month' | 'quarter' | 'year'
type Tab = 'pedidos' | 'produtos' | 'financeiro'

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Este mês', last_month: 'Mês anterior', quarter: 'Trimestre', year: 'Este ano',
}
const TAB_LABELS: Record<Tab, string> = { pedidos: 'Vendas e pedidos', produtos: 'Produtos', financeiro: 'Financeiro' }

function usePeriodRange(period: Period) {
  return useMemo(() => {
    const now = new Date()
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) }
    if (period === 'last_month') return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) }
    if (period === 'quarter') return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) }
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) }
  }, [period])
}

function useReportData(companyId: string | null, start: Date, end: Date) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-relatorios', companyId, start.toISOString(), end.toISOString()],
    enabled: !!companyId,
    queryFn: async () => {
      const startIso = start.toISOString()
      const endIso = end.toISOString()
      const [{ data: orders }, { data: finTx }, { data: company }] = await Promise.all([
        supabase.from('orders')
          .select('id, order_number, status, total, created_at, order_items(name, quantity, subtotal)')
          .eq('company_id', companyId as string)
          .gte('created_at', startIso).lte('created_at', endIso) as any,
        supabase.from('financial_transactions')
          .select('type, amount, category, date')
          .eq('company_id', companyId as string)
          .gte('date', startIso).lte('date', endIso) as any,
        supabase.from('companies').select('name, email, logo_url').eq('id', companyId as string).single() as any,
      ])
      return { orders: orders ?? [], finTx: finTx ?? [], company }
    },
  })
}

export default function PrecyflowRelatoriosPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const [period, setPeriod] = useState<Period>('month')
  const [tab, setTab] = useState<Tab>('pedidos')
  const { start, end } = usePeriodRange(period)
  const { data, isLoading } = useReportData(companyId, start, end)

  const orders = data?.orders ?? []
  const finTx = data?.finTx ?? []
  const validOrders = orders.filter((o: any) => o.status !== 'cancelled')
  const totalVendas = validOrders.reduce((s: number, o: any) => s + Number(o.total), 0)
  const income = finTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expense = finTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)

  const productTotals = useMemo(() => {
    const map = new Map<string, { quantity: number; total: number }>()
    for (const o of validOrders) {
      for (const item of (o.order_items ?? [])) {
        const name = item.name ?? 'Item'
        const cur = map.get(name) ?? { quantity: 0, total: 0 }
        cur.quantity += Number(item.quantity)
        cur.total += Number(item.subtotal)
        map.set(name, cur)
      }
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)
  }, [validOrders])

  async function handleExport() {
    if (!data) return
    const { generateReportPDF } = await import('@/lib/pdf/generateReportPDF')
    generateReportPDF({
      tab, period, start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd'),
      company: data.company, orders: validOrders, finTx, products: productTotals,
      mode: 'pdf',
    })
  }

  return (
    <div>
      <PrecyflowHeader title="Relatórios" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="pf-card inline-flex p-1 gap-1 flex-wrap">
            {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t ? 'pf-btn-primary' : ''}`}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select className="input w-40" value={period} onChange={e => setPeriod(e.target.value as Period)}>
              {(Object.keys(PERIOD_LABELS) as Period[]).map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
            <button onClick={handleExport} disabled={isLoading} className="pf-btn-primary flex items-center gap-2 px-3 py-2.5 text-sm">
              <Download size={14} /> Exportar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="pf-card h-64 animate-pulse" />
        ) : tab === 'pedidos' ? (
          validOrders.length === 0 ? (
            <div className="pf-card"><PrecyflowEmptyState icon={BarChart2} title="Sem pedidos no período" subtitle="Ajuste o período para ver os dados." /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="pf-card p-4"><p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Total em vendas</p><p className="text-xl font-bold mt-1">{formatCurrency(totalVendas)}</p></div>
                <div className="pf-card p-4"><p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Pedidos</p><p className="text-xl font-bold mt-1">{validOrders.length}</p></div>
                <div className="pf-card p-4"><p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Ticket médio</p><p className="text-xl font-bold mt-1">{formatCurrency(validOrders.length ? totalVendas / validOrders.length : 0)}</p></div>
              </div>
              <div className="pf-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                    <th className="px-4 py-3 font-medium">Pedido</th><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 font-medium text-right">Valor</th>
                  </tr></thead>
                  <tbody>
                    {validOrders.map((o: any) => (
                      <tr key={o.id} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                        <td className="px-4 py-3">#{o.order_number}</td>
                        <td className="px-4 py-3">{format(new Date(o.created_at), 'dd/MM/yyyy')}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(o.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : tab === 'produtos' ? (
          productTotals.length === 0 ? (
            <div className="pf-card"><PrecyflowEmptyState icon={BarChart2} title="Sem vendas de produtos no período" /></div>
          ) : (
            <div className="pf-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                  <th className="px-4 py-3 font-medium">Produto</th><th className="px-4 py-3 font-medium">Qtd. vendida</th><th className="px-4 py-3 font-medium text-right">Total</th>
                </tr></thead>
                <tbody>
                  {productTotals.map(p => (
                    <tr key={p.name} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                      <td className="px-4 py-3">{p.name}</td>
                      <td className="px-4 py-3">{p.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          finTx.length === 0 ? (
            <div className="pf-card"><PrecyflowEmptyState icon={BarChart2} title="Sem lançamentos financeiros no período" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="pf-card p-4"><p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Entradas</p><p className="text-xl font-bold mt-1 text-success">{formatCurrency(income)}</p></div>
              <div className="pf-card p-4"><p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Saídas</p><p className="text-xl font-bold mt-1 text-error">{formatCurrency(expense)}</p></div>
              <div className="pf-card p-4"><p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Saldo</p><p className="text-xl font-bold mt-1">{formatCurrency(income - expense)}</p></div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
