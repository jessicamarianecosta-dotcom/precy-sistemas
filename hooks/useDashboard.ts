import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { startOfMonth, endOfMonth, startOfYear, format } from 'date-fns'

export function useDashboard(companyId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboard', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) throw new Error('No company')

      const now = new Date()
      const monthStart = startOfMonth(now).toISOString()
      const monthEnd = endOfMonth(now).toISOString()
      const yearStart = startOfYear(now).toISOString()

      // Faturamento do mês
      const { data: incomes } = await supabase
        .from('transactions')
        .select('amount')
        .eq('company_id', companyId)
        .eq('type', 'income')
        .gte('date', monthStart)
        .lte('date', monthEnd)

      // Despesas do mês
      const { data: expenses } = await supabase
        .from('transactions')
        .select('amount')
        .eq('company_id', companyId)
        .eq('type', 'expense')
        .gte('date', monthStart)
        .lte('date', monthEnd)

      // Pedidos ativos
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, total, status, due_date, customers(name)')
        .eq('company_id', companyId)
        .in('status', ['pending', 'production', 'ready'])
        .order('created_at', { ascending: false })
        .limit(5)

      // Pedidos por status
      const { data: ordersByStatus } = await supabase
        .from('orders')
        .select('status')
        .eq('company_id', companyId)

      // Estoque crítico
      const { data: criticalStock } = await supabase
        .from('inventory')
        .select('id, name, quantity, minimum_quantity, unit, status')
        .eq('company_id', companyId)
        .in('status', ['critical', 'attention'])
        .order('quantity', { ascending: true })
        .limit(5)

      // Gráfico mensal (12 meses)
      const { data: monthlyData } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('company_id', companyId)
        .gte('date', yearStart)
        .lte('date', monthEnd)

      // Últimos pedidos
      const { data: latestOrders } = await supabase
        .from('orders')
        .select('id, order_number, total, status, created_at, customers(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5)

      // Calcular métricas
      const revenue = incomes?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0
      const expensesTotal = expenses?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0
      const profit = revenue - expensesTotal

      // Organizar dados mensais para gráfico
      const chartData: Record<string, { month: string; receita: number; despesas: number; lucro: number }> = {}

      monthlyData?.forEach(t => {
        const month = format(new Date(t.date), 'MMM', { locale: undefined })
        if (!chartData[month]) {
          chartData[month] = { month, receita: 0, despesas: 0, lucro: 0 }
        }
        if (t.type === 'income') chartData[month].receita += Number(t.amount)
        if (t.type === 'expense') chartData[month].despesas += Number(t.amount)
        chartData[month].lucro = chartData[month].receita - chartData[month].despesas
      })

      const statusCounts = {
        pending: 0, production: 0, ready: 0, delivered: 0, cancelled: 0
      }
      ordersByStatus?.forEach(o => {
        const s = o.status as keyof typeof statusCounts
        if (s in statusCounts) statusCounts[s]++
      })

      return {
        revenue,
        profit,
        expensesTotal,
        activeOrdersCount: statusCounts.pending + statusCounts.production + statusCounts.ready,
        criticalStockCount: criticalStock?.length ?? 0,
        activeOrders: activeOrders ?? [],
        criticalStock: criticalStock ?? [],
        chartData: Object.values(chartData),
        latestOrders: latestOrders ?? [],
        ordersByStatus: statusCounts,
      }
    },
    refetchInterval: 30_000, // Atualiza a cada 30s
  })
}
