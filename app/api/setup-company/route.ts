import { NextResponse }             from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                  from 'next/headers'
import { supabaseAdmin }            from '@/lib/supabase/admin'

/**
 * POST /api/setup-company
 * Garante que o usuário autenticado tem uma empresa.
 * Usa supabaseAdmin (service role) para bypassar RLS.
 */
export async function POST() {
  try {
    // Pegar usuário pela sessão server-side
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user }, error: userError } = await serverClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se já tem empresa (usando admin para evitar problemas de RLS)
    const { data: existing } = await (supabaseAdmin as any).from('companies').select('id, name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing?.id) {
      return NextResponse.json({ companyId: existing.id, created: false })
    }

    // Buscar profile para pegar nome
    const { data: profile } = await (supabaseAdmin as any).from('profiles').select('name, email')
      .eq('id', user.id)
      .maybeSingle()

    // Criar empresa com admin (bypassa RLS)
    const companyName =
      (user.user_metadata?.company_name as string) ||
      (profile?.name as string) ||
      user.email?.split('@')[0] ||
      'Meu Negócio'

    const { data: company, error: createError } = await (supabaseAdmin as any).from('companies').insert({
        user_id:              user.id,
        name:                 companyName,
        email:                user.email ?? '',
        work_hours_per_month: 160,
        fixed_costs:          0,
        currency:             'BRL',
        timezone:             'America/Sao_Paulo',
      })
      .select('id')
      .single()

    if (createError) {
      console.error('[setup-company] create error:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ companyId: company.id, created: true })
  } catch (err) {
    console.error('[setup-company] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
