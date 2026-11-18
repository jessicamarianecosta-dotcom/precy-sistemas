/* Cliente Supabase para Client Components do PrecyFlow. Fica separado de
   supabase-server.ts de propósito: um arquivo só com os dois (como tinha
   antes) importava `next/headers` no topo e quebrava o build assim que
   qualquer componente 'use client' importava dele — webpack bundla o
   módulo inteiro, next/headers só existe em Server Components. */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const createClient = () => createClientComponentClient()
