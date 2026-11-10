import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { convertBudgetToOrder } from '@/lib/orders/convertBudgetToOrder'

/**
 * POST /api/loja/orcamento/[token]/aprovar
 * Aprovação pelo cliente no link público. Idempotente: clicar várias vezes
 * (ou recarregar a página) nunca cria mais de um pedido — reaproveita a
 * mesma lógica de conversão usada pelo painel administrativo.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = String((await params).token ?? '')
  if (!token) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })

  if (!checkRateLimit(`loja-orcamento-aprovar:${getClientIp(request)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const db = supabaseAdmin as any

  const { data: budget, error } = await db
    .from('budgets')
    .select('id, company_id, status, valid_until, converted_to_order_id')
    .eq('public_token', token)
    .maybeSingle()

  if (error || !budget || budget.status === 'draft') {
    return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })
  }

  if (budget.status === 'approved' || budget.status === 'converted' || budget.converted_to_order_id) {
    const result = await convertBudgetToOrder(db, budget.id, budget.company_id)
    if (result.ok) {
      return NextResponse.json({ ok: true, alreadyApproved: true, orderNumber: result.orderNumber })
    }
    return NextResponse.json({ ok: true, alreadyApproved: true })
  }

  if (budget.status === 'rejected') {
    return NextResponse.json({ error: 'Este orçamento já foi reprovado. Entre em contato com a empresa para reemissão.' }, { status: 409 })
  }

  const isExpired = !!budget.valid_until && new Date(budget.valid_until) < new Date()
  if (isExpired) {
    return NextResponse.json({ error: 'Este orçamento está vencido. Entre em contato com a empresa para revalidação.' }, { status: 409 })
  }

  const { error: approveErr } = await db
    .from('budgets')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', budget.id)
    .in('status', ['sent', 'viewed'])
  if (approveErr) {
    return NextResponse.json({ error: 'Erro ao aprovar orçamento' }, { status: 500 })
  }

  const result = await convertBudgetToOrder(db, budget.id, budget.company_id)
  if (!result.ok) {
    // Orçamento já está marcado como aprovado mesmo que a conversão falhe —
    // o lojista consegue converter manualmente pelo painel depois.
    console.error('[loja/orcamento/aprovar] falha ao converter', result.error)
    return NextResponse.json({ ok: true, orderNumber: null })
  }

  return NextResponse.json({ ok: true, orderNumber: result.orderNumber })
}
