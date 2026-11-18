import { createClient } from '@supabase/supabase-js'

/* Mesma instância/projeto do lib/supabase/admin.ts (service role), mas sem
   o generic `Database` do Precy+ — suas tabelas precyflow_* não existem
   nesse tipo, então toda query tipada como Precy+ colapsava para `never`.
   Usado só em rotas server-side que precisam escrever sem RLS (ex.:
   checkout público da vitrine, onde quem escreve não é o dono da loja). */
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

export const precyflowAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
