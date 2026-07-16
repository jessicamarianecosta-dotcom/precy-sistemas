import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions'

/**
 * POST /api/legal/accept
 * Registra o aceite jurídico dos Termos de Uso + Política de Privacidade
 * (versão atual) para o usuário autenticado. Chamada tanto no cadastro
 * quanto na tela de re-aceite (/termos/reaceite) e no checkout PRO.
 *
 * Nunca confia no frontend: exige { accepted: true } explícito no corpo e
 * deriva usuário/IP/user-agent sempre do lado do servidor.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (body?.accepted !== true) {
      return NextResponse.json({ error: 'Aceite não confirmado.' }, { status: 400 })
    }

    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: company } = await (supabaseAdmin.from('companies') as any)
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent')

    const { data: consent, error } = await (supabaseAdmin.from('user_consents') as any)
      .insert({
        user_id: user.id,
        company_id: company?.id ?? null,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
      })
      .select()
      .single()

    if (error) {
      console.error('[legal/accept] erro ao registrar aceite:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, consent })
  } catch (err) {
    console.error('[legal/accept] erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
