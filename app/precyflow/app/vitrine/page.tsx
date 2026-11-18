import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { VitrineAdminClient } from '@/components/precyflow/vitrine/VitrineAdminClient'
import type { PrecyFlowProduct } from '@/lib/precyflow/types'

export const metadata = { title: 'Vitrine Virtual' }

export default async function VitrinePage() {
  const { supabase, store } = await getStoreOrRedirect()

  const { data: products } = await supabase
    .from('precyflow_products')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('display_order')

  return <VitrineAdminClient store={store} initialProducts={(products ?? []) as PrecyFlowProduct[]} />
}
