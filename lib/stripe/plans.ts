/**
 * Configurações de planos e limites — SAFE para client-side e server-side.
 * NÃO importar o Stripe SDK aqui.
 */

export const PLANS = {
  basic: {
    id:         'basic',
    name:       'Basic',
    price:      1700,
    priceLabel: 'R$ 17/mês',
    get price_id() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_BASIC ?? process.env.STRIPE_PRICE_ID_BASIC ?? '' },
    trialDays:  7,
  },
  pro: {
    id:         'pro',
    name:       'Pro',
    price:      4700,
    priceLabel: 'R$ 47/mês',
    get price_id() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID_PRO ?? '' },
    trialDays:  0,
  },
} as const

export type PlanId = keyof typeof PLANS

// Limites por plano — used in both client and server
export const PLAN_LIMITS: Record<PlanId, { products: number; orders: number; categories: number; published_products: number }> = {
  basic: { products: 20, orders: 30, categories: 0,  published_products: 0 },
  pro:   { products: Infinity, orders: Infinity, categories: 20, published_products: 500 },
}

// Resolve plano a partir do Stripe price_id (server-side env vars)
export function getPlanFromPriceId(priceId: string): PlanId {
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro'
  return 'basic'
}
