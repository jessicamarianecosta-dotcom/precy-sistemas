import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { checkPlan, type PlanCheck } from '@/lib/subscription/check'
import { isCatalogImportAdmin } from '@/lib/catalog/importAccess'

type AuthResult =
  | { ok: true; userId: string; companyId: string; plan: PlanCheck }
  | { ok: false; response: NextResponse }

/**
 * Autorização da função "Importar Catálogo" (Produtos → Importar Catálogo).
 * Mesmo padrão de requireCatalogAccess() (lib/catalog/server-auth.ts), mas
 * com um gate a mais: SOMENTE a conta dona do sistema pode processar PDF,
 * pré-visualizar itens ou criar/atualizar produtos por este fluxo — nunca
 * confiar em esconder o botão no frontend, a checagem real é aqui, chamada
 * no início de toda rota de API de importação, antes de qualquer leitura ou
 * escrita em `products`.
 */
export async function requireCatalogImportAccess(): Promise<AuthResult> {
  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  if (!isCatalogImportAdmin(user.email)) {
    return { ok: false, response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
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
