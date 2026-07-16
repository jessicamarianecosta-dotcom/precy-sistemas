import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

const VALID_TYPES = ['deletion', 'anonymization']

/**
 * POST /api/lgpd/request
 * Registra uma solicitação de exclusão de conta ou anonimização de dados
 * (LGPD Art. 18) — nunca executa automaticamente. Fica pendente em
 * lgpd_requests para processamento manual pela equipe, conforme a
 * Política de Privacidade.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const requestType = body?.requestType
    if (!VALID_TYPES.includes(requestType)) {
      return NextResponse.json({ error: 'Tipo de solicitação inválido.' }, { status: 400 })
    }

    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: company } = await (supabaseAdmin.from('companies') as any)
      .select('id').eq('user_id', user.id).maybeSingle()

    const { data: row, error } = await (supabaseAdmin.from('lgpd_requests') as any)
      .insert({ user_id: user.id, company_id: company?.id ?? null, request_type: requestType })
      .select()
      .single()

    if (error) {
      console.error('[lgpd/request] erro ao registrar solicitação:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, request: row })
  } catch (err) {
    console.error('[lgpd/request] erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
