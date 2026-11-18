import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/precyflow/supabase-server'
import type { PrecyFlowStore } from '@/lib/precyflow/types'

/* Usado no topo de cada página server-side de /precyflow/app/**. A própria
   layout (app/precyflow/app/layout.tsx) já garante sessão + loja antes de
   renderizar qualquer página filha, então este redirect é só uma rede de
   segurança — na prática a loja já existe sempre que esta função roda. */
export async function getStoreOrRedirect(): Promise<{ supabase: ReturnType<typeof createServerClient>; store: PrecyFlowStore }> {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/precyflow/login')

  const { data: store } = await supabase
    .from('precyflow_stores')
    .select('*')
    .eq('owner_id', session.user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!store) redirect('/precyflow/onboarding')

  return { supabase, store: store as PrecyFlowStore }
}
