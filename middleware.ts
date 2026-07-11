import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'

/* ── Rotas públicas ── */
const PUBLIC = ['/', '/login', '/cadastro', '/recuperar-senha', '/nova-senha',
                '/termos', '/privacidade', '/reembolso', '/loja', '/api/loja']

/* ── Rotas exclusivas PRO ── */
const PRO_ROUTES = ['/agenda', '/financeiro', '/relatorios', '/conteudo', '/financeiro-avancado',
                    '/catalogo', '/api/catalogo']

/* ── Rota de bloqueio por inadimplência ── */
const BLOCKED_ROUTE   = '/assinatura/bloqueada'
const UPGRADE_ROUTE   = '/assinatura/upgrade'
const DASHBOARD_ROOT  = '/dashboard'

/* ── Tolerância após vencimento: 5 dias ── */
const GRACE_DAYS = 5

function isBlocked(status: string, periodEnd: string | null, gracePeriodEnd: string | null): boolean {
  if (status === 'blocked') return true
  if (status === 'active' || status === 'trialing') return false
  // past_due: verificar se ultrapassou 5 dias de tolerância
  if (status === 'past_due') {
    const grace = gracePeriodEnd
      ? new Date(gracePeriodEnd)
      : periodEnd
        ? new Date(new Date(periodEnd).getTime() + GRACE_DAYS * 86400000)
        : null
    if (grace && new Date() > grace) return true
  }
  if (status === 'canceled' || status === 'expired') {
    // Cancelado: ainda no período pago? Libera. Senão bloqueia.
    if (periodEnd && new Date() < new Date(periodEnd)) return false
    return true
  }
  return false
}

function isTrialExpired(status: string, trialEnd: string | null): boolean {
  if (status !== 'trialing') return false
  if (!trialEnd) return false
  return new Date() > new Date(trialEnd)
}

export async function middleware(req: NextRequest) {
  const res      = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  /* ── Webhooks e assets: sempre livres ── */
  if (pathname.startsWith('/api/webhooks') || pathname.startsWith('/_next')) {
    return res
  }

  /* ── Páginas legais públicas ── */
  const isPublic = PUBLIC.some(r => r === pathname || (r !== '/' && pathname.startsWith(r + '/')))
  if (isPublic) {
    if (session && (pathname === '/login' || pathname === '/cadastro')) {
      return NextResponse.redirect(new URL(DASHBOARD_ROOT, req.url))
    }
    return res
  }

  /* ── Não autenticado → login ── */
  if (!session) {
    const url = new URL('/login', req.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  /* ── Página de bloqueio: permite acesso + checkout/portal ── */
  const isSubscriptionPage = pathname.startsWith('/assinatura')
  const isCheckoutApi      = pathname.startsWith('/api/stripe')

  if (isSubscriptionPage || isCheckoutApi) return res

  /* ── Buscar plano da empresa (companies usa company_id do usuário) ── */
  const { data: company } = await supabase
    .from('companies')
    .select('current_plan, subscription_status, trial_end, current_period_end, grace_period_end, role')
    .eq('user_id', session.user.id)
    .single()

  /* ── Desenvolvedor: ignora todas as restrições de assinatura ── */
  if (company?.role === 'developer') return res

  const plan   = (company?.current_plan        ?? 'basic')   as string
  const status = (company?.subscription_status ?? 'trialing') as string
  const trialEnd  = company?.trial_end         ?? null
  const periodEnd = company?.current_period_end ?? null
  const gracePE   = company?.grace_period_end   ?? null

  /* ── Trial expirado → downgrade silencioso para basic ── */
  const trialExpired = isTrialExpired(status, trialEnd)

  /* ── Verificar bloqueio por inadimplência ── */
  const blocked = isBlocked(status, periodEnd, gracePE)
  if (blocked) {
    if (pathname !== BLOCKED_ROUTE) {
      return NextResponse.redirect(new URL(BLOCKED_ROUTE, req.url))
    }
    return res
  }

  /* ── Aviso de past_due na toolbar (header) ── */
  if (status === 'past_due') {
    res.headers.set('x-subscription-warning', 'past_due')
  }

  /* ── Proteção de rotas PRO ── */
  // trial válido → acesso PRO completo; trial expirado → reverte para plan do banco
  const effectivePlan: string = (!trialExpired && status === 'trialing') ? 'pro' : plan

  const isProRoute = PRO_ROUTES.some(r => pathname.startsWith(r))
  if (isProRoute && effectivePlan !== 'pro') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Catálogo Online é exclusivo do Plano PRO' }, { status: 403 })
    }
    const url = new URL(UPGRADE_ROUTE, req.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|public).*)'],
}
