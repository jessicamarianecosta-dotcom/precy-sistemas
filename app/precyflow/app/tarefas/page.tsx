import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { TarefasClient } from '@/components/precyflow/tarefas/TarefasClient'
import type { PrecyFlowTask } from '@/lib/precyflow/types'

export const metadata = { title: 'Tarefas' }

export default async function TarefasPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const { data: tasks } = await supabase
    .from('precyflow_tasks')
    .select('*')
    .eq('store_id', store.id)
    .order('due_date', { ascending: true, nullsFirst: false })

  return <TarefasClient storeId={store.id} initialTasks={(tasks ?? []) as PrecyFlowTask[]} />
}
