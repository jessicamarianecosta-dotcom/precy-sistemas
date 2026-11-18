import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { ConfiguracoesClient } from '@/components/precyflow/configuracoes/ConfiguracoesClient'

export const metadata = { title: 'Configurações' }

export default async function ConfiguracoesPage() {
  const { supabase, store } = await getStoreOrRedirect()
  const { data: { session } } = await supabase.auth.getSession()

  return <ConfiguracoesClient store={store} userEmail={session?.user.email ?? ''} />
}
