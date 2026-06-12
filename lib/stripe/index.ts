/**
 * Stripe SDK — SERVER-SIDE ONLY.
 * Nunca importar este arquivo diretamente em 'use client' components.
 * Para constantes de plano no client, use '@/lib/stripe/plans'.
 */
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY — configure esta variável no Vercel.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// Re-exportar tudo de plans.ts para conveniência em server code
export { PLANS, PLAN_LIMITS, getPlanFromPriceId } from './plans'
export type { PlanId } from './plans'

// Compatibilidade com código antigo
export const STRIPE_PLANS = {
  pro_monthly:   { name: 'Pro',   price: 4700, price_id: process.env.STRIPE_PRICE_ID_PRO   ?? '' },
  basic_monthly: { name: 'Basic', price: 1700, price_id: process.env.STRIPE_PRICE_ID_BASIC ?? '' },
}
