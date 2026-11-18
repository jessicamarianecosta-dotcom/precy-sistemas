import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { RelatoriosClient } from '@/components/precyflow/relatorios/RelatoriosClient'
import type { PrecyFlowOrder, PrecyFlowOrderItem, PrecyFlowTransaction } from '@/lib/precyflow/types'

export const metadata = { title: 'Relatórios' }

export default async function RelatoriosPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const [{ data: orders }, { data: transactions }] = await Promise.all([
    supabase.from('precyflow_orders').select('*, customer:precyflow_customers(*)').eq('store_id', store.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('precyflow_financial_transactions').select('*').eq('store_id', store.id).limit(500),
  ])

  const orderIds = (orders ?? []).map(o => o.id)
  const { data: items } = orderIds.length
    ? await supabase.from('precyflow_order_items').select('*').in('order_id', orderIds)
    : { data: [] as PrecyFlowOrderItem[] }

  return (
    <RelatoriosClient
      orders={(orders ?? []) as PrecyFlowOrder[]}
      items={(items ?? []) as PrecyFlowOrderItem[]}
      transactions={(transactions ?? []) as PrecyFlowTransaction[]}
    />
  )
}
