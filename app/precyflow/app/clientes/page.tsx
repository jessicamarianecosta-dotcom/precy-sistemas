import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { ClientesClient } from '@/components/precyflow/clientes/ClientesClient'
import type { PrecyFlowCustomer } from '@/lib/precyflow/types'

export const metadata = { title: 'Clientes' }

export default async function ClientesPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const { data: customers } = await supabase
    .from('precyflow_customers')
    .select('*')
    .eq('store_id', store.id)
    .order('name')

  return <ClientesClient storeId={store.id} initialCustomers={(customers ?? []) as PrecyFlowCustomer[]} />
}
