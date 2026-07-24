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

/* ── Feedback: exclusivo de quem já paga (Basic ou PRO) ──
   Diferente das rotas PRO acima: aqui quem está em trial NÃO tem acesso,
   mesmo que o trial conceda PRO temporário em todo o resto do sistema.
   O corte é "assinatura realmente ativa", não "plano contratado". */
const PAID_ONLY_ROUTES = ['/feedback', '/api/feedback']
const FEEDBACK_LOCKED_ROUTE = '/feedback-indisponivel'

/* ── Catálogo Online: beta privado, gate por e-mail (ver lib/catalog/betaAccess.ts)
   substitui o gate de PRO enquanto durar o beta — /loja/[slug] (storefront
   público) continua liberado, só a administração do catálogo é restrita ── */
const CATALOG_ROUTES = ['/catalogo', '/api/catalogo']
const CATALOG_SOON_ROUTE = '/catalogo-em-breve'

/* ── Rotas de bloqueio ── */
const BLOCKED_ROUTE       = '/assinatura/bloqueada'   // era pagante, parou de pagar
const TRIAL_EXPIRED_ROUTE = '/assinatura/expirada'    // nunca assinou, trial acabou
const UPGRADE_ROUTE       = '/assinatura/upgrade'
const DASHBOARD_ROOT      = '/dashboard'

/* ── Tolerância após vencimento: 5 dias ── */
const GRACE_DAYS = 5

/* Fail-closed por padrão: só libera nos status que comprovadamente
   significam "está pagando ou ainda dentro do trial vigente". Antes,
   'trialing' nunca bloqueava — nem quando trial_end já tinha passado e
   nenhuma assinatura Stripe jamais foi criada, o que dava acesso Basic
   permanente e gratuito a quem nunca pagou nada (Basic é pago, R$17/mês,
   não existe plano gratuito). Qualquer status não reconhecido
   (unpaid/incomplete/incomplete_expired/paused/etc.) também bloqueia. */
function isBlocked(status: string, trialEnd: string | null, periodEnd: string | null, gracePeriodEnd: string | null): boolean {
  if (status === 'active') return false
  if (status === 'trialing') {
    // trial_end nulo nunca significa "trial eterno" — bloqueia.
    if (!trialEnd) return true
    return new Date() > new Date(trialEnd)
  }
  if (status === 'past_due') {
    const grace = gracePeriodEnd
      ? new Date(gracePeriodEnd)
      : periodEnd
        ? new Date(new Date(periodEnd).getTime() + GRACE_DAYS * 86400000)
        : null
    return !!(grace && new Date() > grace)
  }
  if (status === 'canceled' || status === 'expired') {
    // Cancelado: ainda no período pago? Libera. Senão bloqueia.
    if (periodEnd && new Date() < new Date(periodEnd)) return false
    return true
  }
  // 'none': empresa ainda não provisionada (janela transitória logo após
  // o cadastro, antes de /api/setup-company criar a linha) — não bloqueia,
  // fica em Basic sem PRO até a empresa existir de fato.
  if (status === 'none') return false
  return true
}

function isTrialExpired(status: string, trialEnd: string | null): boolean {
  if (status !== 'trialing') return false
  if (!trialEnd) return false
  return new Date() > new Date(trialEnd)
}

/* Espelha public.company_has_paid_plan() (Postgres) — mesma regra, checada
   de novo aqui para bloquear a navegação antes mesmo de bater no banco via
   RLS. 'trialing' nunca retorna true, mesmo com trial_end no futuro. */
function hasPaidPlan(status: string, periodEnd: string | null, gracePeriodEnd: string | null): boolean {
  if (status === 'active') return true
  if (status === 'past_due' && gracePeriodEnd && new Date() < new Date(gracePeriodEnd)) return true
  if (status === 'canceled' && periodEnd && new Date() < new Date(periodEnd)) return true
  return false
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

  /* ── Trial expirado (ainda dentro do trial ⇒ PRO liberado) ── */
  const trialExpired = isTrialExpired(status, trialEnd)

  /* ── Verificar bloqueio: trial esgotado sem nunca ter assinado, OU
     assinatura paga que parou de ser honrada (inadimplência/cancelamento) ── */
  const blocked = isBlocked(status, trialEnd, periodEnd, gracePE)
  if (blocked) {
    // 'trialing' bloqueado só pode significar "trial acabou e nunca houve
    // assinatura Stripe" (se tivesse existido uma, o webhook já teria
    // mudado o status para outra coisa) — mensagem e destino diferentes
    // de "era pagante e parou de pagar".
    const target = status === 'trialing' ? TRIAL_EXPIRED_ROUTE : BLOCKED_ROUTE
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({
        error: status === 'trialing'
          ? 'Seu período de teste terminou. Assine um plano para continuar.'
          : 'Assinatura inativa.',
      }, { status: 403 })
    }
    if (pathname !== target) {
      return NextResponse.redirect(new URL(target, req.url))
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

  /* ── Feedback: exige assinatura paga (Basic ou PRO); trial fica de fora ── */
  const isPaidOnlyRoute = PAID_ONLY_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (isPaidOnlyRoute && pathname !== FEEDBACK_LOCKED_ROUTE && !hasPaidPlan(status, periodEnd, gracePE)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Este recurso estará disponível após a assinatura de um plano pago.' }, { status: 403 })
    }
    return NextResponse.redirect(new URL(FEEDBACK_LOCKED_ROUTE, req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|public|icon|apple-icon|opengraph-image|twitter-image).*)'],
}
