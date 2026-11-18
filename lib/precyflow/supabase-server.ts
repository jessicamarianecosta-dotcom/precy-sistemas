/* Cliente Supabase para Server Components/layouts do PrecyFlow — ver
   supabase-client.ts para o porquê de estar em arquivo separado. */
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const createServerClient = () => createServerComponentClient({ cookies })
