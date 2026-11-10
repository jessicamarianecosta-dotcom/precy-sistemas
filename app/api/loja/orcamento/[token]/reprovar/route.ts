import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * POST /api/loja/orcamento/[token]/reprovar
 * Reprovação pelo cliente no link público, com motivo opcional.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = String((await params).token ?? '')
  if (!token) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })

  if (!checkRateLimit(`loja-orcamento-reprovar:${getClientIp(request)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null

  const db = supabaseAdmin as any

  const { data: budget, error } = await db
    .from('budgets')
    .select('id, status')
    .eq('public_token', token)
    .maybeSingle()

  if (error || !budget || budget.status === 'draft') {
    return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })
  }

  if (budget.status === 'rejected') {
    return NextResponse.json({ ok: true, alreadyRejected: true })
  }

  if (budget.status === 'approved' || budget.status === 'converted') {
    return NextResponse.json({ error: 'Este orçamento já foi aprovado e não pode ser reprovado.' }, { status: 409 })
  }

  const { error: rejectErr } = await db
    .from('budgets')
    .update({ status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: reason })
    .eq('id', budget.id)
    .in('status', ['sent', 'viewed'])
  if (rejectErr) {
    return NextResponse.json({ error: 'Erro ao registrar reprovação' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
