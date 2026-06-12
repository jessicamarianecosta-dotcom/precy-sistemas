'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { PLAN_LIMITS } from '@/lib/stripe'

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
  limits:              typeof PLAN_LIMITS.basic
}

export function useSubscription() {
  const supabase    = createClient()
  const { companyId } = useCompanyId()

  return useQuery<SubscriptionData>({
    queryKey: ['subscription', companyId],
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 min
    queryFn: async () => {
      const { data, error } = await (supabase.from('companies') as any)
        .select('current_plan, subscription_status, trial_end, current_period_end, stripe_customer_id, stripe_subscription_id')
        .eq('id', companyId!)
        .single()

      if (error || !data) {
        // Fallback: considerar como basic em trial
        return {
          plan: 'basic', status: 'trialing', trialEnd: null, periodEnd: null,
          stripeCustomerId: null, stripeSubscriptionId: null,
          isActive: true, isTrial: true, isPro: false, isExpired: false,
          limits: PLAN_LIMITS.basic,
        }
      }

      const plan      = (data.current_plan ?? 'basic') as 'basic' | 'pro'
      const status    = data.subscription_status ?? 'trialing'
      const isActive  = ['active','trialing'].includes(status)
      const isTrial   = status === 'trialing'
      const isPro     = plan === 'pro' && isActive
      const isExpired = ['canceled','past_due','expired'].includes(status)

      return {
        plan, status,
        trialEnd:             data.trial_end ?? null,
        periodEnd:            data.current_period_end ?? null,
        stripeCustomerId:     data.stripe_customer_id ?? null,
        stripeSubscriptionId: data.stripe_subscription_id ?? null,
        isActive, isTrial, isPro, isExpired,
        limits: PLAN_LIMITS[plan] ?? PLAN_LIMITS.basic,
      }
    },
  })
}
