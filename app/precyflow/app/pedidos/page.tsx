import { Suspense } from 'react'
import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { PedidosClient } from '@/components/precyflow/pedidos/PedidosClient'
import type { PrecyFlowCustomer, PrecyFlowOrder, PrecyFlowOrderItem, PrecyFlowProduct } from '@/lib/precyflow/types'

export const metadata = { title: 'Pedidos' }

export default async function PedidosPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const [{ data: orders }, { data: customers }, { data: products }] = await Promise.all([
    supabase.from('precyflow_orders').select('*, customer:precyflow_customers(*)').eq('store_id', store.id).order('created_at', { ascending: false }),
    supabase.from('precyflow_customers').select('*').eq('store_id', store.id).order('name'),
    supabase.from('precyflow_products').select('*').eq('store_id', store.id).eq('is_active', true).order('name'),
  ])

  const orderIds = (orders ?? []).map(o => o.id)
  const { data: items } = orderIds.length
    ? await supabase.from('precyflow_order_items').select('*').in('order_id', orderIds)
    : { data: [] as PrecyFlowOrderItem[] }

  const itemsByOrder = new Map<string, PrecyFlowOrderItem[]>()
  for (const item of (items ?? []) as PrecyFlowOrderItem[]) {
    const list = itemsByOrder.get(item.order_id) ?? []
    list.push(item)
    itemsByOrder.set(item.order_id, list)
  }

  const ordersWithItems = ((orders ?? []) as PrecyFlowOrder[]).map(o => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }))

  return (
    <Suspense fallback={null}>
      <PedidosClient
        storeId={store.id}
        initialOrders={ordersWithItems}
        customers={(customers ?? []) as PrecyFlowCustomer[]}
        products={(products ?? []) as PrecyFlowProduct[]}
      />
    </Suspense>
  )
}
