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
  // Plano anual intermediário — reaproveita quase 100% do sistema (ver
  // ESSENCIAL_ROUTES/PRO_ONLY_ROUTES em middleware.ts para o que ele libera
  // além do Basic). Cobrança anual com parcelamento no cartão ainda não foi
  // implementada no checkout — price_id fica vazio até a Fase 9 do projeto
  // Precy Essencial configurar isso de verdade no Stripe.
  essencial: {
    id:         'essencial',
    name:       'Essencial',
    price:      9700,
    priceLabel: 'R$ 97/ano',
    get price_id() { return process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ESSENCIAL ?? process.env.STRIPE_PRICE_ID_ESSENCIAL ?? '' },
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

// Limites por plano — used in both client and server.
// Essencial: só o limite de pedidos/mês (50) foi confirmado pela Jessica.
// Os demais limites (produtos/categorias/catálogo) ainda não têm definição
// comercial fechada — por ora herdam o mesmo teto do Pro, para não bloquear
// ninguém à toa; ajustar aqui quando esses números forem definidos.
export const PLAN_LIMITS: Record<PlanId, { products: number; orders: number; categories: number; published_products: number }> = {
  basic:     { products: 20, orders: 30, categories: 0,  published_products: 0 },
  essencial: { products: Infinity, orders: 50, categories: 20, published_products: 500 },
  pro:       { products: Infinity, orders: Infinity, categories: 20, published_products: 500 },
}

// Resolve plano a partir do Stripe price_id (server-side env vars)
export function getPlanFromPriceId(priceId: string): PlanId {
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_ID_ESSENCIAL) return 'essencial'
  return 'basic'
}
