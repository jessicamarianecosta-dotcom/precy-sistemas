import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'
import { canAccessCatalog }       from '@/lib/catalog/betaAccess'
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions'

/* ── Rotas públicas ── */
const PUBLIC = ['/', '/login', '/cadastro', '/recuperar-senha', '/nova-senha',
                '/termos', '/privacidade', '/reembolso', '/cancelamento', '/suporte',
                '/loja', '/api/loja']

/* ── Gate de re-aceite de Termos/Privacidade: liberado mesmo sem aceite
   atual, para não gerar loop de redirecionamento ── */
const LEGAL_GATE_ALLOWLIST = ['/termos/reaceite', '/api/legal/accept']
const REACCEPT_ROUTE = '/termos/reaceite'

/* ── Rotas exclusivas PRO ──
   /relatorios NÃO entra aqui: a página tem abas Basic (Pedidos, Clientes,
   Produtos, Estoque, Orçamentos — dados que o Basic já acessa nos módulos
   originais) e uma aba PRO (Financeiro, cujos dados já são bloqueados por
   RLS via company_has_pro_access em financial_transactions/cost_centers).
   Bloquear a rota inteira contradizia a promessa de "Relatórios básicos"
   no plano Basic; o gate da aba Financeiro fica dentro da própria página. */
const PRO_ROUTES = ['/agenda', '/financeiro', '/conteudo', '/financeiro-avancado']

/* ── Catálogo Online: beta privado, gate por e-mail (ver lib/catalog/betaAccess.ts)
   substitui o gate de PRO enquanto durar o beta — /loja/[slug] (storefront
   público) continua liberado, só a administração do catálogo é restrita ── */
const CATALOG_ROUTES = ['/catalogo', '/api/catalogo']
const CATALOG_SOON_ROUTE = '/catalogo-em-breve'

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

  /* ── Termos/Privacidade: gate mais fundamental, antes de qualquer outra
     coisa — bloqueia acesso a QUALQUER rota autenticada até re-aceitar a
     versão atual (nunca confia só no frontend/checkbox de cadastro) ── */
  const isLegalGateExempt = LEGAL_GATE_ALLOWLIST.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (!isLegalGateExempt) {
    const { data: consent } = await supabase
      .from('user_consents')
      .select('terms_version, privacy_version')
      .eq('user_id', session.user.id)
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const needsReaccept = !consent
      || consent.terms_version !== TERMS_VERSION
      || consent.privacy_version !== PRIVACY_VERSION

    if (needsReaccept) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'É necessário aceitar os Termos de Uso e a Política de Privacidade atualizados.' }, { status: 403 })
      }
      return NextResponse.redirect(new URL(REACCEPT_ROUTE, req.url))
    }
  }

  /* ── Página de bloqueio: permite acesso + checkout/portal ── */
  const isSubscriptionPage = pathname.startsWith('/assinatura')
  const isCheckoutApi      = pathname.startsWith('/api/stripe')

  if (isSubscriptionPage || isCheckoutApi) return res

  /* ── Catálogo Online: beta privado — checa ANTES de tudo (independe de
     plano/role), com match exato de segmento para não pegar /catalogo-em-breve ── */
  const isCatalogRoute = CATALOG_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (isCatalogRoute && !canAccessCatalog(session.user.email)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Catálogo Online ainda não está disponível para esta conta.' }, { status: 403 })
    }
    return NextResponse.redirect(new URL(CATALOG_SOON_ROUTE, req.url))
  }

  /* ── Buscar plano da empresa (companies usa company_id do usuário) ──
     IMPORTANTE: nunca usar .single()/.maybeSingle() aqui. Se por qualquer
     motivo existir mais de uma linha para o mesmo user_id, essas variantes
     retornam ERRO (PGRST116) e `company` vira undefined — e os valores
     default abaixo tratavam isso como "trial infinito" (status='trialing'
     + trial_end=null nunca expira), dando acesso PRO permanente e
     irrevogável. Uma seleção simples + ORDER BY nunca falha por
     quantidade de linhas e sempre resolve de forma determinística. */
  const { data: companyRows } = await supabase
    .from('companies')
    .select('current_plan, subscription_status, trial_end, current_period_end, grace_period_end, role')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const company = companyRows?.[0] ?? null

  /* ── Desenvolvedor: ignora todas as restrições de assinatura ── */
  if (company?.role === 'developer') return res

  /* Empresa ainda não provisionada (ex.: instante entre o cadastro e o
     /api/setup-company criar o registro) → nunca conceder PRO por default.
     status='none' não bate em nenhum branch de isTrialExpired/isBlocked
     nem no `status === 'trialing'` do effectivePlan abaixo, então o
     usuário fica em 'basic' (não bloqueado, sem PRO) até a empresa existir. */
  const plan   = (company?.current_plan        ?? 'basic') as string
  const status = (company?.subscription_status ?? 'none')  as string
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

  const isProRoute = PRO_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (isProRoute && effectivePlan !== 'pro') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Este recurso é exclusivo do Plano PRO' }, { status: 403 })
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
