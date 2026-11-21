import { createClient } from '@/lib/supabase/server'

/**
 * Quem já é assinante ativo do Precy+ (logado, plano em dia ou ainda em
 * trial) usa o /montagem de graça, sem comprar o acesso avulso — mesma
 * fórmula de "está em dia" do hook useSubscription (hooks/useSubscription.ts),
 * só que resolvida no servidor (aqui não há React Query/sessão de cliente).
 */
export async function hasActivePrecySubscription(): Promise<boolean> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const { data } = await (supabase.from('companies') as any)
    .select('subscription_status, trial_end, role')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return false
  if (data.role === 'developer') return true

  const status = data.subscription_status ?? 'trialing'
  const trialActive = status === 'trialing' && !!data.trial_end && new Date() < new Date(data.trial_end)
  return status === 'active' || trialActive
}
