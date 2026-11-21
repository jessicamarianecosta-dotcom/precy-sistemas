import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canAccessNotasFiscais } from '@/lib/notasFiscais/betaAccess'

type AuthResult =
  | { ok: true; userId: string; companyId: string }
  | { ok: false; response: NextResponse }

/**
 * Resolve o usuário autenticado + empresa, checando o beta de Notas
 * Fiscais pelo ID estável da sessão (nunca confia em nada vindo do
 * client). Mesmo padrão de lib/catalog/server-auth.ts
 * (requireCatalogAccess) — já bloqueado no middleware para
 * /notas-fiscais e /api/notas-fiscais e /api/bling, mas nunca confiar só
 * na interface/middleware: valida de novo aqui dentro, em toda rota do
 * módulo.
 */
export async function requireNotasFiscaisAccess(): Promise<AuthResult> {
  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  if (!canAccessNotasFiscais(user.id)) {
    return { ok: false, response: NextResponse.json({ error: 'Notas Fiscais ainda não está disponível para esta conta.' }, { status: 403 }) }
  }

  const { data: company } = await (supabaseAdmin.from('companies') as any)
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!company?.id) {
    return { ok: false, response: NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 }) }
  }

  return { ok: true, userId: user.id, companyId: company.id }
}
