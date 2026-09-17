import { getPgPool } from './pg'

/** Resolve o companyId do usuário autenticado direto no Postgres (sem passar pela REST API do Supabase). */
export async function resolveCompanyIdForUser(userId: string): Promise<string | null> {
  const pool = getPgPool()
  const { rows } = await pool.query<{ id: string }>(
    'select id from public.companies where user_id = $1 limit 1',
    [userId]
  )
  return rows[0]?.id ?? null
}
