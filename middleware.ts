import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'

const PUBLIC_ROUTES  = ['/login', '/cadastro', '/recuperar-senha', '/nova-senha', '/termos']
const DASHBOARD_ROOT = '/dashboard'

export async function middleware(req: NextRequest) {
  const res      = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  /* Rota pública → deixar passar */
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r))
  if (isPublic) {
    /* Se já autenticado, redirecionar para dashboard */
    if (session) {
      return NextResponse.redirect(new URL(DASHBOARD_ROOT, req.url))
    }
    return res
  }

  /* Rota raiz → redirecionar conforme session */
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(session ? DASHBOARD_ROOT : '/login', req.url)
    )
  }

  /* Rota protegida sem sessão → login */
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  /* Verificar trial expirado (exceto na página de planos) */
  if (!pathname.startsWith('/configuracoes')) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, trial_ends_at')
      .eq('user_id', session.user.id)
      .single()

    if (subscription) {
      const isExpiredTrial =
        subscription.status === 'trial' &&
        subscription.trial_ends_at &&
        new Date(subscription.trial_ends_at) < new Date()

      const isExpired = subscription.status === 'expired'

      if (isExpiredTrial || isExpired) {
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
