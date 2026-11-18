/* Clientes Supabase dedicados ao PrecyFlow. Reaproveitam a mesma instância
   Supabase (auth.users) do Precy+, mas sem o generic `Database` global —
   as tabelas precyflow_* não foram adicionadas a types/database.ts (que é
   específico do Precy+) para não arriscar alterar a tipagem de todo o
   resto do app por causa de um produto separado. Tipagem de domínio fica
   em lib/precyflow/types.ts, aplicada manualmente nas queries. */
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const createClient = () => createClientComponentClient()

export const createServerClient = () => createServerComponentClient({ cookies })
