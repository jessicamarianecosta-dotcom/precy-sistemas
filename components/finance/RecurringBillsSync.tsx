'use client'

import { useCompanyId } from '@/hooks/useCompanyId'
import { useRecurringBillsSync } from '@/hooks/useRecurringBillsSync'

/**
 * Monta em todo o dashboard (ver app/(dashboard)/layout.tsx). Ao abrir o
 * sistema, sincroniza Contas Recorrentes → Financeiro uma vez por sessão,
 * para todas as telas (Financeiro, Dashboard, Fluxo de Caixa, DRE,
 * Metas, Projeção) — não só quando o usuário visita a aba "Contas
 * Recorrentes" em Financeiro Avançado.
 */
export function RecurringBillsSync() {
  const { companyId } = useCompanyId()
  useRecurringBillsSync(companyId)
  return null
}
