import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  format,
} from 'date-fns'

export function useDashboard(
  companyId: string | null
) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboard', companyId],

    enabled: !!companyId,

    queryFn: async () => {
      if (!companyId) {
        throw new Error('No company')
      }

      const now = new Date()

      const monthStart =
        startOfMonth(now).toISOString()

      const monthEnd =
        endOfMonth(now).toISOString()

      const yearStart =
        startOfYear(now).toISOString()

      const incomesResponse: any =
        await supabase
          .from('transactions')
          .select('amount')
          .eq('company_id', companyId)
          .eq('type', 'income')
          .gte('date', monthStart)
          .lte('date', monthEnd)

      const incomes =
        incomesResponse?.data ?? []

      const expensesResponse: any =
        await supabase
          .from('transactions')
          .select('amount')
          .eq('company_id', companyId)
          .eq('type', 'expense')
          .gte('date', monthStart)
          .lte('date', monthEnd)

      const expenses =
        expensesResponse?.data ?? []

      const activeOrdersResponse: any =
        await supabase
          .from('orders')
          .select(
            'id, total, status, due_date, customers(name)'
          )
          .eq('company_id', companyId)
          .in('status', [
            'pending',
            'production',
            'ready',
          ])
          .order('created_at', {
            ascending: false,
          })
          .limit(5)

      const activeOrders =
        activeOrdersResponse?.data ?? []

      const ordersByStatusResponse: any =
        await supabase
          .from('orders')
          .select('status')
          .eq('company_id', companyId)

      const ordersByStatus =
        ordersByStatusResponse?.data ??
        []

      const criticalStockResponse: any =
        await supabase
          .from('inventory')
          .select(
            'id, name, quantity, minimum_quantity, unit, status'
          )
          .eq('company_id', companyId)
          .in('status', [
            'critical',
            'attention',
          ])
          .order('quantity', {
            ascending: true,
          })
          .limit(5)

      const criticalStock =
        criticalStockResponse?.data ??
        []

      const monthlyDataResponse: any =
        await supabase
          .from('transactions')
          .select(
            'amount, type, date'
          )
          .eq('company_id', companyId)
          .gte('date', yearStart)
          .lte('date', monthEnd)

      const monthlyData =
        monthlyDataResponse?.data ?? []

      const latestOrdersResponse: any =
        await supabase
          .from('orders')
          .select(
            'id, order_number, total, status, created_at, customers(name)'
          )
          .eq('company_id', companyId)
          .order('created_at', {
            ascending: false,
          })
          .limit(5)

      const latestOrders =
        latestOrdersResponse?.data ??
        []

      const revenue =
        (incomes as any[])?.reduce(
          (
            sum,
            t: any
          ) =>
            sum +
            Number(t.amount),
          0
        ) ?? 0

      const expensesTotal =
        (expenses as any[])?.reduce(
          (
            sum,
            t: any
          ) =>
            sum +
            Number(t.amount),
          0
        ) ?? 0

      const profit =
        revenue - expensesTotal

      const chartData: Record<
        string,
        {
          month: string
          receita: number
          despesas: number
          lucro: number
        }
      > = {}

      ;(monthlyData as any[])?.forEach(
        (t: any) => {
          const month = format(
            new Date(t.date),
            'MMM',
            {
              locale: undefined,
            }
          )

          if (!chartData[month]) {
            chartData[month] = {
              month,
              receita: 0,
              despesas: 0,
              lucro: 0,
            }
          }

          if (t.type === 'income') {
            chartData[
              month
            ].receita += Number(
              t.amount
            )
          }

          if (
            t.type === 'expense'
          ) {
            chartData[
              month
            ].despesas += Number(
              t.amount
            )
          }

          chartData[month].lucro =
            chartData[
              month
            ].receita -
            chartData[
              month
            ].despesas
        }
      )

      const statusCounts = {
        pending: 0,
        production: 0,
        ready: 0,
        delivered: 0,
        cancelled: 0,
      }

      ;(
        ordersByStatus as any[]
      )?.forEach((o: any) => {
        const s =
          o.status as keyof typeof statusCounts

        if (s in statusCounts) {
          statusCounts[s]++
        }
      })

      return {
        revenue,

        profit,

        expensesTotal,

        activeOrdersCount:
          statusCounts.pending +
          statusCounts.production +
          statusCounts.ready,

        criticalStockCount:
          criticalStock?.length ??
          0,

        activeOrders,

        criticalStock,

        chartData:
          Object.values(chartData),

        latestOrders,

        ordersByStatus:
          statusCounts,
      }
    },

    refetchInterval: 30000,
  })
}
