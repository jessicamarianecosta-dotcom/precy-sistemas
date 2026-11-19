import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { renderChargePix } from '@/lib/orders/chargePix'
import { computeChargeDisplay, CHARGE_STATUS_LABELS } from '@/lib/orders/charges'

/**
 * GET /api/loja/cobranca/[token]
 * Rota pública — abre a cobrança pelo token opaco (order_charges.public_token),
 * mesmo padrão de /api/loja/orcamento/[token]: sempre via service role,
 * nunca RLS anônima, nunca expõe o id sequencial.
 *
 * Side-effect: registra visualização (primeira/última, view_count).
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = String((await params).token ?? '')
  if (!token) return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })

  if (!checkRateLimit(`loja-cobranca-ver:${getClientIp(request)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const db = supabaseAdmin as any

  const { data: charge, error } = await db
    .from('order_charges')
    .select(`
      id, order_id, amount, due_date, notes, status, pix_type, pix_key, pix_label, pix_txid,
      sent_at, first_viewed_at, last_viewed_at, view_count, created_at,
      orders(order_number, service_name, description, total, status, customer_id),
      customers(name, phone, email, cpf_cnpj),
      companies(name, email, phone, cnpj, logo_url, primary_color, secondary_color, city)
    `)
    .eq('public_token', token)
    .maybeSingle()

  if (error || !charge) {
    return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })
  }

  const order = charge.orders
  if (!order) return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })

  const { data: payments } = await db
    .from('payment_history')
    .select('amount')
    .eq('order_id', charge.order_id)
  const received = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)

  const display = computeChargeDisplay({
    chargeAmount: Number(charge.amount),
    chargeStatus: charge.status,
    dueDate: charge.due_date,
    orderTotal: Number(order.total),
    orderReceived: received,
    orderStatus: order.status,
  })

  if (charge.status === 'cancelada') {
    return NextResponse.json({ error: 'Esta cobrança foi cancelada.' }, { status: 410 })
  }

  // Registrar visualização (best-effort)
  const now = new Date().toISOString()
  const viewUpdate: Record<string, unknown> = {
    last_viewed_at: now,
    view_count: (Number(charge.view_count) || 0) + 1,
  }
  if (!charge.first_viewed_at) viewUpdate.first_viewed_at = now
  await db.from('order_charges').update(viewUpdate).eq('id', charge.id)

  let pix = null
  if (!display.isSettled && charge.pix_key) {
    try {
      pix = await renderChargePix({
        pixKey: charge.pix_key,
        pixType: charge.pix_type,
        pixLabel: charge.pix_label || charge.companies?.name || 'RECEBEDOR',
        merchantCity: charge.companies?.city || 'BRASIL',
        amount: display.amountDue,
        txid: charge.pix_txid || charge.id,
      })
    } catch (err) {
      console.error('[loja/cobranca] erro ao gerar BR Code Pix', err)
    }
  }

  return NextResponse.json({
    charge: {
      amount_requested: display.amountRequested,
      amount_due: display.amountDue,
      due_date: charge.due_date,
      notes: charge.notes,
      status: display.status,
      status_label: CHARGE_STATUS_LABELS[display.status],
      created_at: charge.created_at,
    },
    order: {
      order_number: order.order_number,
      service_name: order.service_name,
      description: order.description,
      total: order.total,
    },
    customer: {
      name: charge.customers?.name ?? null,
    },
    company: {
      name: charge.companies?.name ?? '',
      email: charge.companies?.email ?? null,
      phone: charge.companies?.phone ?? null,
      cnpj: charge.companies?.cnpj ?? null,
      logo_url: charge.companies?.logo_url ?? null,
      primary_color: charge.companies?.primary_color ?? '#8B6C4F',
      secondary_color: charge.companies?.secondary_color ?? '#2C2018',
    },
    pix,
  })
}
