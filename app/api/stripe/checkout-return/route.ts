import { NextRequest, NextResponse } from 'next/server'
import { stripe }                     from '@/lib/stripe'
import { syncCompanyFromCheckoutSession } from '@/lib/stripe/syncSubscription'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                    from 'next/headers'

export const runtime = 'nodejs'

/**
 * GET /api/stripe/checkout-return?session_id=cs_...
 *
 * success_url do Checkout Session aponta pra cá em vez de direto pro
 * /dashboard. Sincroniza a assinatura no banco SÍNCRONA e SERVER-SIDE,
 * antes de redirecionar — assim o middleware, ao avaliar a navegação pro
 * /dashboard logo em seguida, já enxerga o estado novo. Sem isso, existe
 * uma corrida real entre "o navegador do cliente volta do Stripe" e "o
 * webhook assíncrono processa o evento", e o middleware podia bloquear o
 * usuário de novo mesmo com o pagamento já aprovado.
 *
 * O webhook (/api/webhooks/stripe) continua sendo a fonte de verdade
 * assíncrona e a rede de segurança — esta rota nunca falha a navegação:
 * se a sincronização síncrona der erro por qualquer motivo, ainda
 * redireciona pro dashboard, e o webhook (ou o polling em
 * /assinatura/expirada) fecha o resto.
 */
export async function GET(req: NextRequest) {
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://precyplus.com.br'
  const sessionId = req.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.redirect(new URL('/dashboard', appUrl))
  }

  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    const cs = await stripe.checkout.sessions.retrieve(sessionId)

    // Nunca confiar em session_id vindo da URL sozinho: só sincroniza se a
    // sessão realmente pertence ao usuário autenticado nesta navegação.
    if (!user || cs.metadata?.user_id !== user.id) {
      console.warn('[checkout-return] session_id não pertence ao usuário autenticado, ignorando')
      return NextResponse.redirect(new URL('/dashboard', appUrl))
    }

    await syncCompanyFromCheckoutSession(cs, '[checkout-return]')
  } catch (err: any) {
    console.error('[checkout-return] erro ao sincronizar:', err?.message ?? err)
  }

  return NextResponse.redirect(new URL('/dashboard?checkout=success', appUrl))
}
