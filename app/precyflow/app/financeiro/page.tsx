import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { FinanceiroClient } from '@/components/precyflow/financeiro/FinanceiroClient'
import type { PrecyFlowTransaction } from '@/lib/precyflow/types'

export const metadata = { title: 'Financeiro' }

export default async function FinanceiroPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const { data: transactions } = await supabase
    .from('precyflow_financial_transactions')
    .select('*')
    .eq('store_id', store.id)
    .order('due_date', { ascending: false })

  return <FinanceiroClient storeId={store.id} initialTransactions={(transactions ?? []) as PrecyFlowTransaction[]} />
}
