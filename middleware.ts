import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'

/* Rotas 100% públicas – nunca redirecionar */
const PUBLIC_ROUTES = ['/', '/login', '/cadastro', '/recuperar-senha', '/nova-senha', '/termos']
const DASHBOARD_ROOT = '/dashboard'

export async function middleware(req: NextRequest) {
  const res      = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  /* ── Rotas públicas (inclui landing page em /) ── */
  const isPublic = PUBLIC_ROUTES.some(r => r === pathname || (r !== '/' && pathname.startsWith(r)))
  if (isPublic) {
    /* Se autenticado tentando ir para login/cadastro → dashboard */
    if (session && (pathname === '/login' || pathname === '/cadastro')) {
      return NextResponse.redirect(new URL(DASHBOARD_ROOT, req.url))
    }
    return res   /* landing page e outras públicas passam livremente */
  }

  /* ── Rota protegida sem sessão → login ── */
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  /* ── Verificar trial / plano expirado ── */
  if (!pathname.startsWith('/configuracoes')) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, trial_ends_at')
      .eq('user_id', session.user.id)
      .single()

    if (subscription) {
      const trialExpired =
        subscription.status === 'trial' &&
        subscription.trial_ends_at &&
        new Date(subscription.trial_ends_at) < new Date()

      const planExpired = subscription.status === 'expired'

      if (trialExpired || planExpired) {
        const configUrl = new URL('/configuracoes', req.url)
        configUrl.searchParams.set('tab', 'plano')
        configUrl.searchParams.set('expired', '1')
        return NextResponse.redirect(configUrl)
      }
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api/webhooks).*)',
  ],
}
