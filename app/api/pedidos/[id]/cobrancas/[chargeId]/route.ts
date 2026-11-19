import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'

/**
 * PATCH /api/pedidos/[id]/cobrancas/[chargeId] — cancela uma cobrança.
 * Não afeta financial_transactions/payment_history: a cobrança nunca
 * tocou no financeiro, então cancelar é só invalidar o link público.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; chargeId: string }> }) {
  const { id: orderId, chargeId } = await params

  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const companyId = await resolveCompanyIdForUser(user.id)
  if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  if (body.status !== 'cancelada') {
    return NextResponse.json({ error: 'Operação não suportada' }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('order_charges')
    .update({ status: 'cancelada', cancelled_at: new Date().toISOString() })
    .eq('id', chargeId)
    .eq('order_id', orderId)
    .eq('company_id', companyId)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
