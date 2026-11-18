import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { EstoqueClient } from '@/components/precyflow/estoque/EstoqueClient'
import type { PrecyFlowMaterial, PrecyFlowProduct } from '@/lib/precyflow/types'

export const metadata = { title: 'Estoque' }

export default async function EstoquePage() {
  const { supabase, store } = await getStoreOrRedirect()

  const [{ data: products }, { data: materials }] = await Promise.all([
    supabase.from('precyflow_products').select('*').eq('store_id', store.id).order('name'),
    supabase.from('precyflow_materials').select('*').eq('store_id', store.id).order('name'),
  ])

  return (
    <EstoqueClient
      initialProducts={(products ?? []) as PrecyFlowProduct[]}
      initialMaterials={(materials ?? []) as PrecyFlowMaterial[]}
    />
  )
}
