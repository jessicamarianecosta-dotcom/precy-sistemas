import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/admin/feedbacks
 * Lista TODOS os feedbacks de TODAS as empresas — usa supabaseAdmin
 * (bypassa RLS) porque a policy de feedbacks é tenant-scoped por
 * design (cada empresa só vê a própria). Acesso restrito a quem tem
 * companies.role = 'developer', igual ao padrão já usado em
 * library_products_write_developer.
 *
 * Query params (todos opcionais):
 *   type      - sugestao | bug | reclamacao | elogio | nova_funcionalidade
 *   company   - busca por nome da empresa (ilike)
 *   plan      - basic | pro (current_plan da empresa)
 *   status    - novo | em_analise | respondido | concluido
 *   date_from - YYYY-MM-DD (created_at >=)
 *   date_to   - YYYY-MM-DD (created_at <=)
 */
export async function GET(request: Request) {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: requester } = await (supabaseAdmin.from('companies') as any)
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (requester?.role !== 'developer') {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
    }

    const url = new URL(request.url)
    const type     = url.searchParams.get('type')
    const company  = url.searchParams.get('company')
    const plan     = url.searchParams.get('plan')
    const status   = url.searchParams.get('status')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo   = url.searchParams.get('date_to')

    let query = (supabaseAdmin.from('feedbacks') as any)
      .select('*, companies(name, current_plan, email)')
      .order('created_at', { ascending: false })

    if (type)   query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo)   query = query.lte('created_at', `${dateTo}T23:59:59`)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: `Erro ao listar feedbacks: ${error.message}` }, { status: 500 })
    }

    // Filtros que dependem da tabela relacionada (companies) são aplicados
    // em memória — mais simples que embed filter do PostgREST em relação
    // aninhada, e o volume de feedbacks não justifica otimizar isso agora.
    let rows = data ?? []
    if (plan) {
      rows = rows.filter((f: any) => f.companies?.current_plan === plan)
    }
    if (company) {
      const needle = company.toLowerCase()
      rows = rows.filter((f: any) => (f.companies?.name ?? '').toLowerCase().includes(needle))
    }

    return NextResponse.json({ feedbacks: rows, total: rows.length })
  } catch (err) {
    console.error('[admin/feedbacks] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
