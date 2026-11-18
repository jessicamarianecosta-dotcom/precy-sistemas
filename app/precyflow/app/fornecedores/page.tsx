import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { FornecedoresClient } from '@/components/precyflow/fornecedores/FornecedoresClient'
import type { PrecyFlowMaterial, PrecyFlowSupplier } from '@/lib/precyflow/types'

export const metadata = { title: 'Fornecedores' }

export default async function FornecedoresPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const [{ data: suppliers }, { data: materials }] = await Promise.all([
    supabase.from('precyflow_suppliers').select('*').eq('store_id', store.id).order('name'),
    supabase.from('precyflow_materials').select('*').eq('store_id', store.id),
  ])

  return (
    <FornecedoresClient
      storeId={store.id}
      initialSuppliers={(suppliers ?? []) as PrecyFlowSupplier[]}
      materials={(materials ?? []) as PrecyFlowMaterial[]}
    />
  )
}
