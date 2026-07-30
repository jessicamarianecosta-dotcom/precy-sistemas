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

export async function getAssinantes(): Promise<Assinante[]> {
  const { data, error } = await (supabaseAdmin.from('companies') as any)
    .select('id, name, email, created_at, trial_end, subscription_status, current_plan, profiles:user_id(name, email)')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: row.created_at,
    trial_end: row.trial_end,
    subscription_status: row.subscription_status,
    current_plan: row.current_plan,
    owner_name: row.profiles?.name ?? null,
    owner_email: row.profiles?.email ?? null,
  }))
}
