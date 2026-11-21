import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { buildChargePixSnapshot } from '@/lib/orders/chargePix'
import { sanitizeTxid } from '@/lib/pix/brcode'
import { computeCustomerChargeDisplay } from '@/lib/orders/customerCharges'

interface OpenOrderForCharge {
  orderId: string
  orderNumber: string | null
  serviceName: string | null
  total: number
  received: number
  orderStatus: string
}

/**
 * GET  /api/clientes/[id]/cobranca  — devolve a cobrança agregada ativa (se houver) do cliente.
 * POST /api/clientes/[id]/cobranca  — gera/atualiza o aviso de cobrança agregado do cliente,
 *   somando o saldo em aberto de todos os pedidos informados (ou de todos os pedidos em
 *   aberto do cliente, se nenhum for informado).
 *
 * Mesmo padrão de app/api/pedidos/[id]/cobrancas: reaproveita (nunca duplica) a cobrança
 * "ativa" existente do cliente — ao gerar de novo, atualiza valor/pedidos/vencimento no
 * mesmo registro e no mesmo link público, em vez de criar uma nova linha.
 */

async function requireCompany() {
  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

  const companyId = await resolveCompanyIdForUser(user.id)
  if (!companyId) return { error: NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 }) }

  return { userId: user.id, companyId }
}

/** Saldo em aberto de cada pedido do cliente (orders.total - soma de payment_history), igual a fetchOrderReceivables. */
async function fetchOpenOrdersForCustomer(db: any, companyId: string, customerId: string): Promise<OpenOrderForCharge[]> {
  const { data: orders, error: ordersError } = await db
    .from('orders')
    .select('id, order_number, service_name, total, status')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')

  if (ordersError) throw new Error(ordersError.message)
  if (!orders || orders.length === 0) return []

  const orderIds = orders.map((o: any) => o.id)
  const { data: paymentsRaw, error: paymentsError } = await db
    .from('payment_history')
    .select('order_id, amount')
    .eq('company_id', companyId)
    .in('order_id', orderIds)
  if (paymentsError) throw new Error(paymentsError.message)

  const receivedByOrder: Record<string, number> = {}
  ;(paymentsRaw ?? []).forEach((p: any) => {
    receivedByOrder[p.order_id] = (receivedByOrder[p.order_id] ?? 0) + Number(p.amount)
  })

  return orders.map((o: any) => ({
    orderId: o.id as string,
    orderNumber: o.order_number as string | null,
    serviceName: o.service_name as string | null,
    total: Number(o.total),
    received: receivedByOrder[o.id] ?? 0,
    orderStatus: o.status as string,
  }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const customerId = (await params).id
  const auth = await requireCompany()
  if ('error' in auth) return auth.error

  const db = supabaseAdmin as any
  const { data: charges, error } = await db
    .from('customer_charges')
    .select('*')
    .eq('customer_id', customerId)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ charges: charges ?? [] })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const customerId = (await params).id
  const auth = await requireCompany()
  if ('error' in auth) return auth.error
  const { companyId, userId } = auth

  let body: { due_date?: string; notes?: string | null; order_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const dueDate = String(body.due_date ?? '').trim()
  const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null
  const requestedOrderIds = Array.isArray(body.order_ids) ? body.order_ids.filter(Boolean) : null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: 'Informe uma data de vencimento válida.' }, { status: 400 })
  }

  const db = supabaseAdmin as any

  const { data: customer, error: customerError } = await db
    .from('customers')
    .select('id, name, phone')
    .eq('id', customerId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (customerError || !customer) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  const { data: company, error: companyError } = await db
    .from('companies')
    .select('id, name, pix_type, pix_key, pix_label, city')
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

  let openOrders: OpenOrderForCharge[]
  try {
    openOrders = await fetchOpenOrdersForCustomer(db, companyId, customerId)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  // Nunca inclui pedido quitado ou com saldo zerado — recalcula ao vivo, nunca confia em um total congelado.
  let includedOrders = openOrders.filter(o => round2(o.total - o.received) > 0)

  if (requestedOrderIds && requestedOrderIds.length > 0) {
    const allowed = new Set(requestedOrderIds)
    includedOrders = includedOrders.filter(o => allowed.has(o.orderId))
  }

  if (includedOrders.length === 0) {
    return NextResponse.json({ error: 'Este cliente não tem saldo em aberto para cobrar.' }, { status: 400 })
  }

  const totalAmount = round2(includedOrders.reduce((s, o) => s + round2(o.total - o.received), 0))

  // Reaproveita a cobrança agregada ativa mais recente deste cliente, se existir.
  const { data: existing } = await db
    .from('customer_charges')
    .select('*')
    .eq('customer_id', customerId)
    .eq('company_id', companyId)
    .eq('status', 'ativa')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let charge
  if (existing) {
    const { data: updated, error: updateError } = await db
      .from('customer_charges')
      .update({
        amount: totalAmount,
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

    // Substitui a lista de pedidos incluídos pela seleção atual.
    await db.from('customer_charge_orders').delete().eq('customer_charge_id', charge.id)
  } else {
    const txid = sanitizeTxid(`cliente-${customerId}`)
    const { data: created, error: insertError } = await db
      .from('customer_charges')
      .insert({
        company_id: companyId,
        customer_id: customerId,
        amount: totalAmount,
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

  const { error: linkError } = await db.from('customer_charge_orders').insert(
    includedOrders.map(o => ({
      customer_charge_id: charge.id,
      order_id: o.orderId,
      balance_at_creation: round2(o.total - o.received),
    }))
  )
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })

  const display = computeCustomerChargeDisplay({
    chargeAmount: totalAmount,
    chargeStatus: charge.status,
    dueDate: charge.due_date,
    orders: includedOrders,
  })

  return NextResponse.json({
    charge,
    display,
    public_url: `/loja/cobranca-cliente/${charge.public_token}`,
    customer: { name: customer.name, phone: customer.phone ?? null },
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
