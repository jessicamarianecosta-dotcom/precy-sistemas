import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { checkPlan, type PlanCheck } from '@/lib/subscription/check'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canAccessCatalog } from '@/lib/catalog/betaAccess'

type AuthResult =
  | { ok: true; userId: string; companyId: string; plan: PlanCheck }
  | { ok: false; response: NextResponse }

/**
 * Resolve o usuário autenticado + empresa + checagem de plano PRO, para uso
 * nas rotas de API do Catálogo Online. Nunca confia em companyId vindo do
 * client — sempre deriva da sessão, seguindo o mesmo padrão de
 * app/api/ensure-bucket/route.ts. Devolve 401/403 prontos quando aplicável.
 */
export async function requireCatalogAccess(): Promise<AuthResult> {
  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  // Beta privado: já bloqueado no middleware para /api/catalogo/*, mas nunca
  // confiar só na interface/middleware — validar de novo aqui dentro.
  if (!canAccessCatalog(user.email)) {
    return { ok: false, response: NextResponse.json({ error: 'Catálogo Online ainda não está disponível para esta conta.' }, { status: 403 }) }
  }

  const plan = await checkPlan(user.id)
  if (!plan.companyId) {
    return { ok: false, response: NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 }) }
  }
  if (!plan.isPro) {
    return { ok: false, response: NextResponse.json({ error: 'Catálogo Online é exclusivo do Plano PRO' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id, companyId: plan.companyId, plan }
}

/**
 * Resolve o companyId de uma loja pública pelo slug, usando a MESMA regra
 * de acesso PRO efetivo dos triggers de banco (company_has_catalog_access:
 * current_plan='pro' OU trial ativo OU role='developer') — nunca checar
 * `current_plan === 'pro'` direto aqui, ou empresas em trial/developer
 * ficam com a loja pública fora do ar mesmo tendo acesso PRO no dashboard.
 * Usa supabaseAdmin (rotas públicas não têm sessão/RLS de usuário).
 */
export async function resolveStoreCompanyId(slug: string): Promise<string | null> {
  const { data: settings } = await (supabaseAdmin.from('catalog_settings') as any)
    .select('company_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!settings) return null

  const { data: hasAccess } = await (supabaseAdmin.rpc as any)('company_has_catalog_access', {
    p_company_id: settings.company_id,
  })
  return hasAccess ? (settings.company_id as string) : null
}
