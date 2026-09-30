import { supabaseAdmin } from '@/lib/supabase/admin'

export interface Assinante {
  id: string
  name: string
  email: string | null
  created_at: string
  trial_end: string | null
  subscription_status: string | null
  current_plan: string | null
  owner_name: string | null
  owner_email: string | null
}

/*
 * Lista de assinantes (somente leitura).
 *
 * Usa o cliente Supabase com a service_role (via API), o mesmo padrão do
 * resto do app, em vez de conexão direta ao Postgres com senha. Assim a
 * consulta sempre acompanha o projeto Supabase configurado em
 * NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY e não quebra
 * quando uma senha de banco é trocada ou fica desatualizada
 * ("password authentication failed for user postgres").
 */
export async function getAssinantes(): Promise<Assinante[]> {
  // Busca paginada para não esbarrar no limite padrão de linhas da API.
  const pageSize = 1000
  const companies: any[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabaseAdmin as any)
      .from('companies')
      .select('id, name, email, created_at, trial_end, subscription_status, current_plan, user_id')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    companies.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }

  const userIds = Array.from(
    new Set(companies.map((c) => c.user_id).filter((id): id is string => Boolean(id)))
  )

  const owners = new Map<string, { name: string | null; email: string | null }>()
  const chunkSize = 200

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const { data, error } = await (supabaseAdmin as any)
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds.slice(i, i + chunkSize))

    if (error) throw new Error(error.message)
    for (const p of data ?? []) {
      owners.set(p.id, { name: p.name ?? null, email: p.email ?? null })
    }
  }

  return companies.map((row) => {
    const owner = row.user_id ? owners.get(row.user_id) : undefined
    return {
      id: row.id,
      name: row.name,
      email: row.email ?? null,
      created_at: row.created_at,
      trial_end: row.trial_end ?? null,
      subscription_status: row.subscription_status ?? null,
      current_plan: row.current_plan ?? null,
      owner_name: owner?.name ?? null,
      owner_email: owner?.email ?? null,
    }
  })
}
