import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { renderChargePix } from '@/lib/orders/chargePix'
import { computeCustomerChargeDisplay, CUSTOMER_CHARGE_STATUS_LABELS } from '@/lib/orders/customerCharges'

/**
 * GET /api/loja/cobranca-cliente/[token]
 * Rota pública — abre o aviso de cobrança agregado por token opaco
 * (customer_charges.public_token), mesmo padrão de /api/loja/cobranca:
 * sempre via service role, nunca RLS anônima, nunca expõe id sequencial.
 *
 * Side-effect: registra visualização (primeira/última, view_count).
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = String((await params).token ?? '')
  if (!token) return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })

  if (!checkRateLimit(`loja-cobranca-cliente-ver:${getClientIp(request)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const db = supabaseAdmin as any

  const { data: charge, error } = await db
    .from('customer_charges')
    .select(`
      id, customer_id, amount, due_date, notes, status, pix_type, pix_key, pix_label, pix_txid,
      sent_at, first_viewed_at, last_viewed_at, view_count, created_at,
      customers(name, phone),
      companies(name, email, phone, cnpj, logo_url, primary_color, secondary_color, city)
    `)
    .eq('public_token', token)
    .maybeSingle()

  if (error || !charge) {
    return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })
  }

  if (charge.status === 'cancelada') {
    return NextResponse.json({ error: 'Esta cobrança foi cancelada.' }, { status: 410 })
  }

  const { data: links, error: linksError } = await db
    .from('customer_charge_orders')
    .select('order_id, orders(order_number, service_name, total, status)')
    .eq('customer_charge_id', charge.id)

  if (linksError || !links || links.length === 0) {
    return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })
  }

  const orderIds = links.map((l: any) => l.order_id)
  const { data: paymentsRaw } = await db
    .from('payment_history')
    .select('order_id, amount')
    .in('order_id', orderIds)
  const receivedByOrder: Record<string, number> = {}
  ;(paymentsRaw ?? []).forEach((p: any) => {
    receivedByOrder[p.order_id] = (receivedByOrder[p.order_id] ?? 0) + Number(p.amount)
  })

  const orders = links
    .filter((l: any) => l.orders)
    .map((l: any) => ({
      orderId: l.order_id as string,
      orderNumber: l.orders.order_number as string | null,
      serviceName: l.orders.service_name as string | null,
      total: Number(l.orders.total),
      received: receivedByOrder[l.order_id] ?? 0,
      orderStatus: l.orders.status as string,
    }))

  const display = computeCustomerChargeDisplay({
    chargeAmount: Number(charge.amount),
    chargeStatus: charge.status,
    dueDate: charge.due_date,
    orders,
  })

  // Registrar visualização (best-effort).
  const now = new Date().toISOString()
  const viewUpdate: Record<string, unknown> = {
    last_viewed_at: now,
    view_count: (Number(charge.view_count) || 0) + 1,
  }
  if (!charge.first_viewed_at) viewUpdate.first_viewed_at = now
  await db.from('customer_charges').update(viewUpdate).eq('id', charge.id)

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
      console.error('[loja/cobranca-cliente] erro ao gerar BR Code Pix', err)
    }
  }

  return NextResponse.json({
    charge: {
      amount_due: display.amountDue,
      due_date: charge.due_date,
      notes: charge.notes,
      status: display.status,
      status_label: CUSTOMER_CHARGE_STATUS_LABELS[display.status],
      created_at: charge.created_at,
    },
    orders: display.orders.map(o => ({
      order_number: o.orderNumber,
      service_name: o.serviceName,
      total: o.total,
      balance: o.balance,
      settled: o.settled,
    })),
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
