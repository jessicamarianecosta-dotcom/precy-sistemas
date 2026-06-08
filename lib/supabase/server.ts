import { createServerComponentClient } from '@supabase/auth-helpers-next'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export const createServerClient = () =>
  createServerComponentClient<Database>({ cookies })
