import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/precyflow/supabase'
import { ThemeRoot } from '@/components/precyflow/ThemeRoot'
import { AppShell } from '@/components/precyflow/layout/AppShell'
import type { PrecyFlowStore } from '@/lib/precyflow/types'

export default async function PrecyFlowAppLayout({ children }: { children: React.ReactNode }) {
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

  const typedStore = store as PrecyFlowStore

  return (
    <ThemeRoot theme={typedStore.theme} accent={typedStore.theme_color}>
      <AppShell theme={typedStore.theme} storeName={typedStore.name} userEmail={session.user.email ?? null}>
        {children}
      </AppShell>
    </ThemeRoot>
  )
}
