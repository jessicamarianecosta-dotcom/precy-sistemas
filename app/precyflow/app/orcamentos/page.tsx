import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { OrcamentosClient } from '@/components/precyflow/orcamentos/OrcamentosClient'
import type { PrecyFlowBudget, PrecyFlowBudgetItem, PrecyFlowCustomer, PrecyFlowProduct } from '@/lib/precyflow/types'

export const metadata = { title: 'Orçamentos' }

export default async function OrcamentosPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const [{ data: budgets }, { data: customers }, { data: products }] = await Promise.all([
    supabase.from('precyflow_budgets').select('*, customer:precyflow_customers(*)').eq('store_id', store.id).order('created_at', { ascending: false }),
    supabase.from('precyflow_customers').select('*').eq('store_id', store.id).order('name'),
    supabase.from('precyflow_products').select('*').eq('store_id', store.id).eq('is_active', true).order('name'),
  ])

  const budgetIds = (budgets ?? []).map(b => b.id)
  const { data: items } = budgetIds.length
    ? await supabase.from('precyflow_budget_items').select('*').in('budget_id', budgetIds)
    : { data: [] as PrecyFlowBudgetItem[] }

  const itemsByBudget = new Map<string, PrecyFlowBudgetItem[]>()
  for (const item of (items ?? []) as PrecyFlowBudgetItem[]) {
    const list = itemsByBudget.get(item.budget_id) ?? []
    list.push(item)
    itemsByBudget.set(item.budget_id, list)
  }

  const budgetsWithItems = ((budgets ?? []) as PrecyFlowBudget[]).map(b => ({ ...b, items: itemsByBudget.get(b.id) ?? [] }))

  return (
    <OrcamentosClient
      store={store}
      initialBudgets={budgetsWithItems}
      customers={(customers ?? []) as PrecyFlowCustomer[]}
      products={(products ?? []) as PrecyFlowProduct[]}
    />
  )
}
