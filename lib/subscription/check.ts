import { supabaseAdmin } from '@/lib/supabase/admin'
import { PLAN_LIMITS }   from '@/lib/stripe'

const GRACE_DAYS = 5

export interface PlanCheck {
  allowed: boolean; plan: 'basic'|'pro'; status: string
  isPro: boolean; companyId: string; limits: typeof PLAN_LIMITS.basic; reason?: string
}

export async function checkPlan(userId: string): Promise<PlanCheck> {
  const { data: co } = await (supabaseAdmin.from('companies') as any)
    .select('id,current_plan,subscription_status,trial_end,current_period_end,grace_period_end')
    .eq('user_id', userId).single()

  if (!co) return { allowed: false, plan: 'basic', status: 'unknown',
    isPro: false, companyId: '', limits: PLAN_LIMITS.basic, reason: 'Empresa não encontrada' }

  const status = (co.subscription_status ?? 'trialing') as string
  const plan   = (co.current_plan        ?? 'basic')    as 'basic'|'pro'
  const now    = new Date()

  // Fail-closed: só libera nos status que comprovadamente significam
  // "está pagando ou ainda dentro do trial vigente". Basic é pago
  // (R$17/mês) — trial_end no passado sem nunca ter assinado bloqueia
  // por completo, nunca "faz downgrade silencioso pro Basic de graça".
  let blocked: boolean
  if (status === 'active') {
    blocked = false
  } else if (status === 'trialing') {
    blocked = !co.trial_end || now > new Date(co.trial_end)
  } else if (status === 'past_due') {
    const grace = co.grace_period_end ? new Date(co.grace_period_end)
      : co.current_period_end ? new Date(new Date(co.current_period_end).getTime() + GRACE_DAYS*86400000)
      : null
    blocked = !!(grace && now > grace)
  } else if (status === 'canceled' || status === 'expired') {
    blocked = !(co.current_period_end && now < new Date(co.current_period_end))
  } else {
    // 'blocked', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    // ou qualquer status não reconhecido: nunca presumir acesso liberado.
    blocked = true
  }

  if (blocked) return { allowed: false, plan: 'basic', status,
    isPro: false, companyId: co.id, limits: PLAN_LIMITS.basic, reason: 'Assinatura expirada' }

  // Neste ponto, se status === 'trialing' o trial comprovadamente ainda
  // está vigente (senão já teria retornado bloqueado acima).
  const effectivePlan: 'basic'|'pro' = status === 'trialing' ? 'pro' : plan
  return { allowed: true, plan: effectivePlan, status,
    isPro: effectivePlan === 'pro', companyId: co.id, limits: PLAN_LIMITS[effectivePlan] ?? PLAN_LIMITS.basic }
}

export async function checkUsageLimit(
  companyId: string,
  type: 'products'|'orders'|'categories'|'published_products',
  plan: 'basic'|'pro'
) {
  const limit = PLAN_LIMITS[plan][type]
  if (limit === Infinity) return { allowed: true, current: 0, limit: Infinity }
  if (type === 'products') {
    const { count } = await (supabaseAdmin.from('products') as any)
      .select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    const current = count ?? 0
    return { allowed: current < limit, current, limit }
  }
  if (type === 'categories') {
    const { count } = await (supabaseAdmin.from('catalog_categories') as any)
      .select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    const current = count ?? 0
    return { allowed: current < limit, current, limit }
  }
  if (type === 'published_products') {
    const { count } = await (supabaseAdmin.from('products') as any)
      .select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_published_catalog', true)
    const current = count ?? 0
    return { allowed: current < limit, current, limit }
  }
  const start = new Date(); start.setDate(1); start.setHours(0,0,0,0)
  const { count } = await (supabaseAdmin.from('orders') as any)
    .select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', start.toISOString())
  const current = count ?? 0
  return { allowed: current < limit, current, limit }
}
