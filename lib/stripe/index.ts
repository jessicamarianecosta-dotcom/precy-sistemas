import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const PLANS = {
  basic: {
    id:          'basic',
    name:        'Basic',
    price:       1700,            // centavos
    priceLabel:  'R$ 17/mês',
    price_id:    process.env.STRIPE_PRICE_ID_BASIC ?? '',
    trialDays:   7,
  },
  pro: {
    id:          'pro',
    name:        'Pro',
    price:       3700,
    priceLabel:  'R$ 37/mês',
    price_id:    process.env.STRIPE_PRICE_ID_PRO ?? '',
    trialDays:   0,
  },
} as const

export type PlanId = keyof typeof PLANS

// Limites do plano Basic
export const PLAN_LIMITS = {
  basic: { products: 20, orders: 30 },
  pro:   { products: Infinity, orders: Infinity },
}

// Resolve plan a partir do Stripe price_id
export function getPlanFromPriceId(priceId: string): PlanId {
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro'
  return 'basic'
}

// Compatibilidade com código antigo
export const STRIPE_PLANS = {
  pro_monthly: PLANS.pro,
  basic_monthly: PLANS.basic,
}
