import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { MateriaisClient } from '@/components/precyflow/materiais/MateriaisClient'
import type { PrecyFlowMaterial, PrecyFlowSupplier } from '@/lib/precyflow/types'

export const metadata = { title: 'Materiais' }

export default async function MateriaisPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const [{ data: materials }, { data: suppliers }] = await Promise.all([
    supabase.from('precyflow_materials').select('*').eq('store_id', store.id).order('created_at', { ascending: false }),
    supabase.from('precyflow_suppliers').select('*').eq('store_id', store.id).order('name'),
  ])

  return (
    <MateriaisClient
      storeId={store.id}
      initialMaterials={(materials ?? []) as PrecyFlowMaterial[]}
      suppliers={(suppliers ?? []) as PrecyFlowSupplier[]}
    />
  )
}
