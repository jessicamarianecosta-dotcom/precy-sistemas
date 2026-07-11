import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { checkPlan, type PlanCheck } from '@/lib/subscription/check'

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

  const plan = await checkPlan(user.id)
  if (!plan.companyId) {
    return { ok: false, response: NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 }) }
  }
  if (!plan.isPro) {
    return { ok: false, response: NextResponse.json({ error: 'Catálogo Online é exclusivo do Plano PRO' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id, companyId: plan.companyId, plan }
}
