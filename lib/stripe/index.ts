import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'Missing STRIPE_SECRET_KEY'
  )
}

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY,
  {
    apiVersion: '2023-10-16',
    typescript: true,
  }
)

export const STRIPE_PLANS = {
  pro_monthly: {
    name: 'Precy+ Pro',

    description:
      'Acesso completo à plataforma Precy+ Sistemas',

    price_id:
      process.env
        .STRIPE_PRICE_ID_PRO ?? '',

    amount: 3700,

    interval: 'month' as const,
  },
}
