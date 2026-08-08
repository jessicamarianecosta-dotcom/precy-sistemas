'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { syncRecurringBills } from '@/lib/finance/recurringBillsSync'

/**
 * Roda uma vez por sessão do app (montada globalmente via
 * RecurringBillsSync no layout do dashboard — ver
 * app/(dashboard)/layout.tsx): garante que toda conta recorrente ativa
 * tenha um lançamento real no Financeiro para o período de competência
 * atual, sem depender do usuário abrir a aba "Contas Recorrentes".
 */
export function useRecurringBillsSync(companyId: string | null) {
  const supabase    = createClient()
  const queryClient = useQueryClient()
  const ranFor       = useRef<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!companyId || ranFor.current === companyId) return
    ranFor.current = companyId

    let cancelled = false

    async function run() {
      setSyncing(true)
      try {
        const { generated } = await syncRecurringBills(supabase, companyId!)
        if (!cancelled && generated > 0) {
          queryClient.invalidateQueries({ queryKey: ['recurring-bills', companyId] })
          queryClient.invalidateQueries({ queryKey: ['financial-transactions', companyId] })
          queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
          queryClient.invalidateQueries({ queryKey: ['fluxo-caixa', companyId] })
          queryClient.invalidateQueries({ queryKey: ['dre-transactions', companyId] })
          queryClient.invalidateQueries({ queryKey: ['financial-goals', companyId] })
          queryClient.invalidateQueries({ queryKey: ['goals-realized', companyId] })
          queryClient.invalidateQueries({ queryKey: ['projecao-payables', companyId] })
          queryClient.invalidateQueries({ queryKey: ['projecao-receivables', companyId] })
          queryClient.invalidateQueries({ queryKey: ['projecao-recurring', companyId] })
          queryClient.invalidateQueries({ queryKey: ['projecao-saldo-atual', companyId] })
        }
      } catch (err) {
        console.error('[useRecurringBillsSync]', err)
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { syncing }
}
