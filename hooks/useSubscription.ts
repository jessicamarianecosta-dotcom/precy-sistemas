'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { PLAN_LIMITS } from '@/lib/stripe/plans'

export interface SubscriptionData {
  plan:                'basic' | 'pro'
  status:              string
  trialEnd:            string | null
  periodEnd:           string | null
  stripeCustomerId:    string | null
  stripeSubscriptionId:string | null
  isActive:            boolean
  isTrial:             boolean
  isPro:               boolean
  isExpired:           boolean
  isDeveloper:         boolean
  limits:              typeof PLAN_LIMITS.basic
}

export function useSubscription() {
  const supabase      = createClient()
  const { companyId } = useCompanyId()

  return useQuery<SubscriptionData>({
    queryKey: ['subscription', companyId],
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.from('companies') as any)
        .select('current_plan, subscription_status, trial_end, current_period_end, stripe_customer_id, stripe_subscription_id, role')
        .eq('id', companyId!)
        .single()

      if (error || !data) {
        return {
          plan: 'basic', status: 'trialing', trialEnd: null, periodEnd: null,
          stripeCustomerId: null, stripeSubscriptionId: null,
          isActive: true, isTrial: true, isPro: false, isExpired: false,
          isDeveloper: false,
          limits: PLAN_LIMITS.basic,
        }
      }

      // Desenvolvedor: ignora completamente as regras de assinatura
      const isDeveloper = data.role === 'developer'
      if (isDeveloper) {
        return {
          plan: 'pro', status: 'active', trialEnd: null, periodEnd: null,
          stripeCustomerId:     data.stripe_customer_id     ?? null,
          stripeSubscriptionId: data.stripe_subscription_id ?? null,
          isActive: true, isTrial: false, isPro: true, isExpired: false,
          isDeveloper: true,
          limits: PLAN_LIMITS.pro ?? PLAN_LIMITS.basic,
        }
      }

      const plan      = (data.current_plan ?? 'basic') as 'basic' | 'pro'
      const status    = data.subscription_status ?? 'trialing'
      // trial só conta como vigente enquanto trial_end estiver no futuro —
      // status='trialing' com trial_end no passado significa "nunca
      // assinou", não "ainda em trial" (Basic é pago, não há tier grátis).
      const trialActive = status === 'trialing' && !!data.trial_end && new Date() < new Date(data.trial_end)
      const isTrial   = trialActive
      const isActive  = status === 'active' || trialActive
      const isPro     = (plan === 'pro' && status === 'active') || trialActive
      const isExpired = (status === 'trialing' && !trialActive) || ['canceled', 'past_due', 'expired'].includes(status)

      return {
        plan, status,
        trialEnd:             data.trial_end             ?? null,
        periodEnd:            data.current_period_end    ?? null,
        stripeCustomerId:     data.stripe_customer_id    ?? null,
        stripeSubscriptionId: data.stripe_subscription_id ?? null,
        isActive, isTrial, isPro, isExpired,
        isDeveloper: false,
        limits: PLAN_LIMITS[plan] ?? PLAN_LIMITS.basic,
      }
    },
  })
}
