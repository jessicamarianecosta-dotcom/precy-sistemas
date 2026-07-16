import { NextResponse } from 'next/server'
import { PLANS }        from '@/lib/stripe'

/**
 * GET /api/stripe/verify
 * Verifica se o Stripe está configurado corretamente.
 * Retorna um relatório de status sem expor chaves sensíveis.
 */
export async function GET(req: Request) {
  // Proteger com um token simples para evitar leakage de config.
  // Fail-closed: se VERIFY_TOKEN não estiver configurado, a rota fica
  // bloqueada (nunca aberta) — antes, ausência da env var pulava a
  // checagem inteira e deixava a rota pública.
  const token = req.headers.get('x-verify-token')
  const expected = process.env.VERIFY_TOKEN
  if (!expected || token !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }
  const checks = {
    secret_key:          !!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('xxx'),
    webhook_secret:      !!process.env.STRIPE_WEBHOOK_SECRET && !process.env.STRIPE_WEBHOOK_SECRET.includes('xxx'),
    price_id_basic:      !!PLANS.basic.price_id && !PLANS.basic.price_id.includes('xxx') && PLANS.basic.price_id !== '',
    price_id_pro:        !!PLANS.pro.price_id   && !PLANS.pro.price_id.includes('xxx')   && PLANS.pro.price_id !== '',
    app_url:             !!process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL !== 'http://localhost:3000',
    is_live_mode:        !!process.env.STRIPE_SECRET_KEY?.startsWith('sk_live'),
  }

  const allOk = Object.values(checks).every(Boolean)

  // Tentar conectar ao Stripe (sem expor dados sensíveis)
  let stripeConnected = false
  let stripeError = null
  try {
    const { default: Stripe } = await import('stripe')
    const s = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
    await s.balance.retrieve()
    stripeConnected = true
  } catch (err: any) {
    stripeError = err?.message?.slice(0, 100) ?? 'Erro desconhecido'
  }

  return NextResponse.json({
    ok:              allOk && stripeConnected,
    checks,
    stripe_connected: stripeConnected,
    stripe_error:     stripeError,
    plans: {
      basic: { name: PLANS.basic.name, amount: PLANS.basic.price / 100, configured: checks.price_id_basic },
      pro:   { name: PLANS.pro.name,   amount: PLANS.pro.price   / 100, configured: checks.price_id_pro   },
    },
    instructions: allOk && stripeConnected ? null : {
      message: 'Configure as variáveis de ambiente no Vercel:',
      required: [
        !checks.secret_key      && 'STRIPE_SECRET_KEY=sk_live_...',
        !checks.webhook_secret  && 'STRIPE_WEBHOOK_SECRET=whsec_...',
        !checks.price_id_basic  && 'STRIPE_PRICE_ID_BASIC=price_...',
        !checks.price_id_pro    && 'STRIPE_PRICE_ID_PRO=price_...',
        !checks.app_url         && 'NEXT_PUBLIC_APP_URL=https://precyplus.com.br',
      ].filter(Boolean),
    },
  })
}
