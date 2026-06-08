import { createClientComponentClient } from '@supabase/auth-helpers-next'
import { Database } from '@/types/database'

export const createClient = () =>
  createClientComponentClient<Database>()

export const supabase = createClientComponentClient<Database>()
