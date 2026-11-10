import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { convertBudgetToOrder } from '@/lib/orders/convertBudgetToOrder'

/**
 * POST /api/orcamentos/[id]/converter
 * Conversão autenticada (botão do painel). Usa a mesma lógica compartilhada
 * de app/api/loja/orcamento/[token]/aprovar (aprovação pelo cliente), para
 * nunca duplicar o fluxo de orçamento→pedido.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const budgetId = (await params).id
  if (!budgetId) return NextResponse.json({ error: 'Orçamento não informado' }, { status: 400 })

  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const companyId = await resolveCompanyIdForUser(user.id)
  if (!companyId) {
    return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })
  }

  const result = await convertBudgetToOrder(supabaseAdmin as any, budgetId, companyId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result)
}
