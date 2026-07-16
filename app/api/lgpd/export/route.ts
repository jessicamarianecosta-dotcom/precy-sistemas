import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * GET /api/lgpd/export
 * Autoatendimento de acesso/portabilidade (LGPD Art. 18) — baixa um JSON
 * com os dados da conta do usuário autenticado, escopado por company_id
 * (nunca aceita ids do client). Cobre tanto "baixar meus dados" quanto
 * "solicitar exportação dos dados" do pedido original — é o mesmo
 * autoatendimento, sem necessidade de duplicar em dois botões.
 */
export async function GET() {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Gera um dump completo dos dados da empresa — limita a 5 exportações
    // a cada 5 minutos por usuário para evitar chamadas em loop.
    if (!checkRateLimit(`lgpd-export:${user.id}`, 5, 5 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas exportações em pouco tempo. Tente novamente em alguns minutos.' }, { status: 429 })
    }

    const { data: company } = await (supabaseAdmin.from('companies') as any)
      .select('*').eq('user_id', user.id).maybeSingle()

    const companyId = company?.id ?? null

    const tables = [
      'products', 'customers', 'orders', 'order_items', 'budgets', 'budget_items',
      'financial_transactions', 'payment_history', 'inventory', 'suppliers',
    ]

    const data: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      account: { email: user.email, user_id: user.id, created_at: user.created_at },
      company: company ?? null,
    }

    if (companyId) {
      for (const table of tables) {
        const { data: rows } = await (supabaseAdmin.from(table) as any)
          .select('*').eq('company_id', companyId)
        data[table] = rows ?? []
      }
    }

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="precy-meus-dados.json"',
      },
    })
  } catch (err) {
    console.error('[lgpd/export] erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
