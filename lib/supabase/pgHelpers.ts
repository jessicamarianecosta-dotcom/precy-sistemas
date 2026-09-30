import { supabaseAdmin } from './admin'

/**
 * Resolve o companyId do usuário autenticado (companies.user_id) usando o
 * cliente Supabase com service_role — sem conexão direta ao Postgres, então
 * não depende de senha de banco. Mantém o nome do arquivo/função para não
 * quebrar os imports existentes.
 */
export async function resolveCompanyIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.id ?? null
}
