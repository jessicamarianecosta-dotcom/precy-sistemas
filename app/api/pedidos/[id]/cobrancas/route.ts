import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { buildChargePixSnapshot } from '@/lib/orders/chargePix'
import { sanitizeTxid } from '@/lib/pix/brcode'
import { computeChargeDisplay } from '@/lib/orders/charges'

/**
 * GET  /api/pedidos/[id]/cobrancas  — lista cobranças do pedido (mais recente primeiro).
 * POST /api/pedidos/[id]/cobrancas  — cria uma cobrança para o saldo em aberto do pedido.
 *
 * Reaproveita (nunca duplica): se já existir uma cobrança "ativa" para
 * este pedido, ela é atualizada (valor/vencimento/observações) e
 * reaproveitada — mesmo link e mesmo PDF público de antes — em vez de
 * criar uma nova linha. Isso evita links/cobranças duplicadas quando o
 * usuário clica "Gerar cobrança" mais de uma vez para o mesmo pedido.
 */

async function requireCompany() {
  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

  const companyId = await resolveCompanyIdForUser(user.id)
  if (!companyId) return { error: NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 }) }

  return { userId: user.id, companyId }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const orderId = (await params).id
  const auth = await requireCompany()
  if ('error' in auth) return auth.error

  const db = supabaseAdmin as any
  const { data: charges, error } = await db
    .from('order_charges')
    .select('*')
    .eq('order_id', orderId)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ charges: charges ?? [] })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const orderId = (await params).id
  const auth = await requireCompany()
  if ('error' in auth) return auth.error
  const { companyId, userId } = auth

  let body: { amount?: number; due_date?: string; notes?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const amount = Number(body.amount)
  const dueDate = String(body.due_date ?? '').trim()
  const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Informe um valor válido para a cobrança.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: 'Informe uma data de vencimento válida.' }, { status: 400 })
  }

  const db = supabaseAdmin as any

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, company_id, customer_id, order_number, service_name, total, status, paid_at')
    .eq('id', orderId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  const { data: company, error: companyError } = await db
    .from('companies')
    .select('id, name, cnpj, city')
    .eq('id', companyId)
    .maybeSingle()
  if (companyError || !company) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  }

  let pixSnapshot
  try {
    pixSnapshot = buildChargePixSnapshot(company)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  const { data: paymentsRaw } = await db
    .from('payment_history')
    .select('amount')
    .eq('order_id', orderId)
    .eq('company_id', companyId)
  const received = (paymentsRaw ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)
  const balance = Math.round((Number(order.total) - received) * 100) / 100

  if (balance <= 0) {
    return NextResponse.json({ error: 'Este pedido já está quitado — não há saldo pendente para cobrar.' }, { status: 400 })
  }
  if (amount > balance + 0.01) {
    return NextResponse.json({ error: `Valor da cobrança não pode ser maior que o saldo pendente (${balance.toFixed(2)}).` }, { status: 400 })
  }

  // Reaproveita a cobrança ativa mais recente deste pedido, se existir.
  const { data: existing } = await db
    .from('order_charges')
    .select('*')
    .eq('order_id', orderId)
    .eq('company_id', companyId)
    .eq('status', 'ativa')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let charge
  if (existing) {
    const { data: updated, error: updateError } = await db
      .from('order_charges')
      .update({
        amount,
        due_date: dueDate,
        notes,
        pix_type: pixSnapshot.pix_type,
        pix_key: pixSnapshot.pix_key,
        pix_label: pixSnapshot.pix_label,
      })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    charge = updated
  } else {
    const txid = sanitizeTxid(order.order_number || orderId)
    const { data: created, error: insertError } = await db
      .from('order_charges')
      .insert({
        company_id: companyId,
        order_id: orderId,
        customer_id: order.customer_id,
        amount,
        due_date: dueDate,
        notes,
        pix_type: pixSnapshot.pix_type,
        pix_key: pixSnapshot.pix_key,
        pix_label: pixSnapshot.pix_label,
        pix_txid: txid,
        created_by: userId,
      })
      .select('*')
      .single()
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    charge = created
  }

  const display = computeChargeDisplay({
    chargeAmount: Number(charge.amount),
    chargeStatus: charge.status,
    dueDate: charge.due_date,
    orderTotal: Number(order.total),
    orderReceived: received,
    orderStatus: order.status,
  })

  return NextResponse.json({ charge, display, public_url: `/loja/cobranca/${charge.public_token}` })
}
