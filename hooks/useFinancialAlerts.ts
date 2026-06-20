'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { format, addDays, differenceInDays } from 'date-fns'

export type AlertSeverity = 'error' | 'warning' | 'success' | 'info'

export interface FinancialAlert {
  id:       string
  severity: AlertSeverity
  title:    string
  message:  string
  href?:    string  // para onde navegar ao clicar
}

/**
 * Hook compartilhado de alertas financeiros — calculado em tempo real,
 * sem tabela própria. Reusa as mesmas regras de negócio do Financeiro
 * Avançado (caixa real: status received/paid; recorrentes; metas).
 *
 * Usado por: sino de notificações (Header) e aba Alertas (Financeiro Avançado).
 */
export function useFinancialAlerts() {
  const supabase = createClient()
  const { companyId } = useCompanyId()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const in7days  = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  return useQuery<FinancialAlert[]>({
    queryKey: ['financial-alerts', companyId, todayStr],
    enabled:  !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      const alerts: FinancialAlert[] = []

      /* ── 1. Contas a pagar VENCIDAS (status due, ou to_pay com data passada) ── */
      const { data: overdueBills } = await (supabase.from('financial_transactions') as any)
        .select('id, description, amount, date, status')
        .eq('company_id', companyId!)
        .eq('type', 'expense')
        .in('status', ['to_pay', 'due'])
        .lt('date', todayStr)

      if ((overdueBills ?? []).length > 0) {
        const total = overdueBills.reduce((s: number, b: any) => s + Number(b.amount), 0)
        alerts.push({
          id: 'overdue-bills',
          severity: 'error',
          title: `${overdueBills.length} conta(s) atrasada(s)`,
          message: `Total de R$ ${total.toFixed(2).replace('.', ',')} em contas vencidas. Regularize para evitar juros.`,
          href: '/financeiro',
        })
      }

      /* ── 2. Contas a pagar vencendo nos próximos 7 dias ── */
      const { data: upcomingBills } = await (supabase.from('financial_transactions') as any)
        .select('id, description, amount, date, status')
        .eq('company_id', companyId!)
        .eq('type', 'expense')
        .eq('status', 'to_pay')
        .gte('date', todayStr)
        .lte('date', in7days)

      if ((upcomingBills ?? []).length > 0) {
        const total = upcomingBills.reduce((s: number, b: any) => s + Number(b.amount), 0)
        alerts.push({
          id: 'upcoming-bills',
          severity: 'warning',
          title: `${upcomingBills.length} conta(s) vencendo em 7 dias`,
          message: `Total de R$ ${total.toFixed(2).replace('.', ',')} a pagar nos próximos dias.`,
          href: '/financeiro',
        })
      }

      /* ── 3. Pedidos com pagamento atrasado (clientes que devem) ── */
      const { data: overdueOrders } = await (supabase.from('orders') as any)
        .select('id, due_date, remaining_amount, total')
        .eq('company_id', companyId!)
        .in('payment_status', ['pending', 'partial'])
        .lt('due_date', todayStr)
        .not('due_date', 'is', null)

      if ((overdueOrders ?? []).length > 0) {
        alerts.push({
          id: 'overdue-receivables',
          severity: 'warning',
          title: `${overdueOrders.length} recebimento(s) atrasado(s)`,
          message: 'Há pedidos com pagamento pendente além da data prevista. Considere entrar em contato com os clientes.',
          href: '/pedidos',
        })
      }

      /* ── 4. Fluxo de caixa: saldo projetado negativo em 30 dias ── */
      const { data: allTx } = await (supabase.from('financial_transactions') as any)
        .select('type, amount, date, status')
        .eq('company_id', companyId!)
        .in('status', ['received', 'paid'])
        .lte('date', todayStr)

      const saldoAtual = (allTx ?? []).reduce((s: number, t: any) =>
        s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)

      const { data: payablesNext30 } = await (supabase.from('financial_transactions') as any)
        .select('amount')
        .eq('company_id', companyId!)
        .eq('type', 'expense')
        .in('status', ['to_pay', 'due'])
        .gte('date', todayStr)
        .lte('date', format(addDays(new Date(), 30), 'yyyy-MM-dd'))

      const totalPayables30 = (payablesNext30 ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)

      if (saldoAtual - totalPayables30 < 0) {
        alerts.push({
          id: 'negative-cashflow',
          severity: 'error',
          title: 'Fluxo de caixa pode ficar negativo',
          message: 'Considerando as contas a pagar dos próximos 30 dias, o saldo projetado é negativo.',
          href: '/financeiro-avancado',
        })
      }

      /* ── 5. Metas: faturamento do mês abaixo do esperado para a data ── */
      const monthKey = format(new Date(), 'yyyy-MM')
      const { data: monthGoal } = await (supabase.from('financial_goals') as any)
        .select('target_amount')
        .eq('company_id', companyId!)
        .eq('goal_type', 'revenue')
        .eq('period_type', 'monthly')
        .eq('period_key', monthKey)
        .eq('is_active', true)
        .maybeSingle()

      if (monthGoal?.target_amount > 0) {
        const monthRevenue = (allTx ?? [])
          .filter((t: any) => t.type === 'income' && t.date.startsWith(monthKey))
          .reduce((s: number, t: any) => s + Number(t.amount), 0)

        const dayOfMonth  = new Date().getDate()
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
        const expectedPct = dayOfMonth / daysInMonth
        const actualPct   = monthRevenue / Number(monthGoal.target_amount)

        if (actualPct >= 1) {
          alerts.push({
            id: 'goal-achieved',
            severity: 'success',
            title: '🎉 Meta de faturamento batida!',
            message: 'Parabéns! Você já atingiu a meta de faturamento deste mês.',
            href: '/financeiro-avancado',
          })
        } else if (actualPct < expectedPct - 0.15) {
          // 15+ pontos percentuais abaixo do ritmo esperado para a data
          alerts.push({
            id: 'goal-behind',
            severity: 'warning',
            title: 'Faturamento abaixo da meta',
            message: `No ritmo atual, a meta de faturamento do mês pode não ser atingida. Faltam R$ ${(Number(monthGoal.target_amount) - monthRevenue).toFixed(2).replace('.', ',')}.`,
            href: '/financeiro-avancado',
          })
        }
      }

      /* ── 6. Estoque crítico (reaproveita lógica já usada no dashboard) ── */
      const { data: criticalStock } = await (supabase.from('inventory') as any)
        .select('id, name, quantity, minimum_quantity')
        .eq('company_id', companyId!)

      const critical = (criticalStock ?? []).filter((i: any) =>
        Number(i.minimum_quantity) > 0 && Number(i.quantity) <= Number(i.minimum_quantity))

      if (critical.length > 0) {
        alerts.push({
          id: 'critical-stock',
          severity: 'warning',
          title: `${critical.length} item(ns) em estoque crítico`,
          message: 'Alguns materiais estão no nível mínimo ou abaixo. Considere repor.',
          href: '/estoque',
        })
      }

      // Ordenar por severidade: erro > atenção > sucesso > info
      const order: Record<AlertSeverity, number> = { error: 0, warning: 1, success: 2, info: 3 }
      return alerts.sort((a, b) => order[a.severity] - order[b.severity])
    },
  })
}
