import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  startOfMonth, endOfMonth, subMonths,
  format, startOfDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function useDashboard(companyId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboard', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      if (!companyId) throw new Error('No company')

      const now         = new Date()
      const monthStart  = startOfMonth(now).toISOString()
      const monthEnd    = endOfMonth(now).toISOString()
      // Previous month for % comparison
      const prevStart   = startOfMonth(subMonths(now, 1)).toISOString()
      const prevEnd     = endOfMonth(subMonths(now, 1)).toISOString()
      // Last 6 months for chart
      const sixMonthsAgo = startOfMonth(subMonths(now, 5)).toISOString()

      /* ── This month income/expense ── */
      const [{ data: incomes }, { data: expenses }] = await Promise.all([
        supabase.from('financial_transactions').select('amount')
          .eq('company_id', companyId).eq('type', 'income')
          .gte('date', monthStart).lte('date', monthEnd) as any,
        supabase.from('financial_transactions').select('amount')
          .eq('company_id', companyId).eq('type', 'expense')
          .gte('date', monthStart).lte('date', monthEnd) as any,
      ])

      /* ── Previous month for delta ── */
      const [{ data: prevIncomesData }, { data: prevExpensesData }] = await Promise.all([
        supabase.from('financial_transactions').select('amount')
          .eq('company_id', companyId).eq('type', 'income')
          .gte('date', prevStart).lte('date', prevEnd) as any,
        supabase.from('financial_transactions').select('amount')
          .eq('company_id', companyId).eq('type', 'expense')
          .gte('date', prevStart).lte('date', prevEnd) as any,
      ])

      /* ── Orders ── */
      const [
        { data: ordersByStatusData },
        { data: latestOrders },
        { data: overdueOrdersData },
      ] = await Promise.all([
        supabase.from('orders').select('status').eq('company_id', companyId) as any,
        supabase.from('orders')
          .select('id, order_number, total, status, created_at, customers(name)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(8) as any,
        supabase.from('orders')
          .select('id')
          .eq('company_id', companyId)
          .in('status', ['pending', 'production', 'ready'])
          .lt('due_date', startOfDay(now).toISOString())
          .not('due_date', 'is', null) as any,
      ])

      /* ── Inventory ── */
      const [
        { data: criticalStock },
        { data: allInventory },
      ] = await Promise.all([
        supabase.from('inventory')
          .select('id, name, quantity, minimum_quantity, unit, status')
          .eq('company_id', companyId)
          .in('status', ['critical', 'attention'])
          .order('quantity', { ascending: true })
          .limit(6) as any,
        supabase.from('inventory')
          .select('status')
          .eq('company_id', companyId) as any,
      ])

      /* ── Budgets pending approval ── */
      const { data: pendingBudgets } = await supabase.from('budgets')
        .select('id').eq('company_id', companyId).eq('status', 'sent') as any

      /* ── 6-month chart ── */
      const { data: sixMonthData } = await supabase.from('financial_transactions')
        .select('amount, type, date')
        .eq('company_id', companyId)
        .gte('date', sixMonthsAgo)
        .lte('date', monthEnd) as any

      /* ── Totals ── */
      const revenue      = (incomes     as any[] ?? []).reduce((s, t) => s + Number(t.amount), 0)
      const expensesTotal= (expenses    as any[] ?? []).reduce((s, t) => s + Number(t.amount), 0)
      const prevRevenue  = (prevIncomesData  as any[] ?? []).reduce((s, t) => s + Number(t.amount), 0)
      const prevExpTotal = (prevExpensesData as any[] ?? []).reduce((s, t) => s + Number(t.amount), 0)
      const profit       = revenue - expensesTotal
      const prevProfit   = prevRevenue - prevExpTotal

      // % deltas (null when previous is 0)
      const revenueDelta  = prevRevenue   > 0 ? ((revenue      - prevRevenue)  / prevRevenue)  * 100 : null
      const profitDelta   = prevProfit > 0 || prevProfit < 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : null

      /* ── Orders by status ── */
      const statusCounts = { pending: 0, production: 0, ready: 0, delivered: 0, cancelled: 0 }
      ;(ordersByStatusData as any[] ?? []).forEach((o: any) => {
        const s = o.status as keyof typeof statusCounts
        if (s in statusCounts) statusCounts[s]++
      })

      /* ── Inventory status counts ── */
      const inventoryCounts = { healthy: 0, attention: 0, critical: 0 }
      ;(allInventory as any[] ?? []).forEach((i: any) => {
        const s = i.status as keyof typeof inventoryCounts
        if (s in inventoryCounts) inventoryCounts[s]++
      })

      /* ── 6-month chart (last 6 full months) ── */
      const chartMap: Record<string, { month: string; receita: number; despesas: number; lucro: number }> = {}
      for (let i = 5; i >= 0; i--) {
        const key = format(subMonths(now, i), 'MMM', { locale: ptBR })
        chartMap[key] = { month: key, receita: 0, despesas: 0, lucro: 0 }
      }
      ;(sixMonthData as any[] ?? []).forEach((t: any) => {
        const key = format(new Date(t.date), 'MMM', { locale: ptBR })
        if (chartMap[key]) {
          if (t.type === 'income')  chartMap[key].receita  += Number(t.amount)
          if (t.type === 'expense') chartMap[key].despesas += Number(t.amount)
          chartMap[key].lucro = chartMap[key].receita - chartMap[key].despesas
        }
      })

      return {
        // metrics
        revenue,
        profit,
        expensesTotal,
        revenueDelta,
        profitDelta,
        activeOrdersCount: statusCounts.pending + statusCounts.production + statusCounts.ready,
        criticalStockCount: (criticalStock as any[] ?? []).length,
        overdueOrdersCount: (overdueOrdersData as any[] ?? []).length,
        pendingBudgetsCount: (pendingBudgets as any[] ?? []).length,
        // lists
        criticalStock: criticalStock ?? [],
        latestOrders:  latestOrders  ?? [],
        // chart data
        chartData:        Object.values(chartMap),
        ordersByStatus:   statusCounts,
        inventoryCounts,
      }
    },
    refetchInterval: 30_000,
    staleTime:       60_000,
  })
}
