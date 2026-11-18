import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { ProdutosClient } from '@/components/precyflow/produtos/ProdutosClient'
import type { PrecyFlowProduct } from '@/lib/precyflow/types'

export const metadata = { title: 'Produtos' }

export default async function ProdutosPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const { data: products } = await supabase
    .from('precyflow_products')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  return <ProdutosClient storeId={store.id} initialProducts={(products ?? []) as PrecyFlowProduct[]} />
}
