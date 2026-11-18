import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { AgendaClient } from '@/components/precyflow/agenda/AgendaClient'
import type { PrecyFlowAgendaEvent, PrecyFlowCustomer } from '@/lib/precyflow/types'

export const metadata = { title: 'Agenda' }

export default async function AgendaPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const [{ data: events }, { data: customers }] = await Promise.all([
    supabase.from('precyflow_agenda_events').select('*').eq('store_id', store.id).order('event_date'),
    supabase.from('precyflow_customers').select('*').eq('store_id', store.id).order('name'),
  ])

  return (
    <AgendaClient
      storeId={store.id}
      initialEvents={(events ?? []) as PrecyFlowAgendaEvent[]}
      customers={(customers ?? []) as PrecyFlowCustomer[]}
    />
  )
}
