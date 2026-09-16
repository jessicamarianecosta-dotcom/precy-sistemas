import { getPgPool } from '@/lib/supabase/pg'

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

export async function getAssinantes(): Promise<Assinante[]> {
  const pool = getPgPool()
  const { rows } = await pool.query(`
    select
      c.id,
      c.name,
      c.email,
      c.created_at,
      c.trial_end,
      c.subscription_status,
      c.current_plan,
      p.name  as owner_name,
      p.email as owner_email
    from public.companies c
    left join public.profiles p on p.id = c.user_id
    order by c.created_at desc
  `)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    trial_end: row.trial_end instanceof Date ? row.trial_end.toISOString() : row.trial_end,
    subscription_status: row.subscription_status,
    current_plan: row.current_plan,
    owner_name: row.owner_name ?? null,
    owner_email: row.owner_email ?? null,
  }))
}
