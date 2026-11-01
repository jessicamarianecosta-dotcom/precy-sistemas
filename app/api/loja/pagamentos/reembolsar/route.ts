import { NextRequest, NextResponse } from 'next/server'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * POST /api/loja/pagamentos/reembolsar
 * Body: { orderId: string, amount?: number, reason?: string }
 *
 * Reembolso real no Mercado Pago — ação financeira, só o dono da loja
 * (sessão autenticada da própria empresa) pode disparar, e só sobre um
 * pagamento aprovado DAQUELE pedido/empresa (nunca de outra loja).
 */
export async function POST(req: NextRequest) {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const orderId = String(body?.orderId ?? '')
  const amount = body?.amount != null ? Number(body.amount) : undefined
  if (!orderId) return NextResponse.json({ error: 'orderId é obrigatório' }, { status: 400 })

  const { data: payment, error: paymentError } = await (supabaseAdmin.from('payments') as any)
    .select('id, provider, provider_payment_id, amount, status')
    .eq('order_id', orderId)
    .eq('company_id', auth.companyId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'Nenhum pagamento aprovado encontrado para este pedido' }, { status: 404 })
  }
  if (amount != null && (amount <= 0 || amount > Number(payment.amount))) {
    return NextResponse.json({ error: 'Valor de reembolso inválido' }, { status: 400 })
  }

  const { data: refundRow, error: refundInsertError } = await (supabaseAdmin.from('payment_refunds') as any)
    .insert([{
      company_id: auth.companyId,
      payment_id: payment.id,
      order_id: orderId,
      amount: amount ?? payment.amount,
      status: 'pending',
      reason: body?.reason ?? null,
      requested_by: auth.userId,
    }])
    .select('id')
    .single()
  if (refundInsertError) return NextResponse.json({ error: refundInsertError.message }, { status: 500 })

  try {
    const result = await getPaymentGateway().refundPayment(auth.companyId, payment.provider_payment_id, amount)
    await (supabaseAdmin.from('payment_refunds') as any)
      .update({ provider_refund_id: result.providerRefundId, status: result.status, raw_response: result.raw })
      .eq('id', refundRow.id)

    // Status final chega também pelo webhook (status=refunded) — aqui já
    // refletimos no pedido para a loja ver o reembolso imediatamente,
    // mesmo que o webhook demore alguns segundos a confirmar.
    if (result.status === 'approved') {
      await (supabaseAdmin.from('payments') as any).update({ status: 'refunded' }).eq('id', payment.id)
      await (supabaseAdmin.from('orders') as any).update({ payment_status: 'refunded' }).eq('id', orderId)
    }

    return NextResponse.json({ ok: true, status: result.status })
  } catch (err: any) {
    await (supabaseAdmin.from('payment_refunds') as any).update({ status: 'rejected' }).eq('id', refundRow.id)
    return NextResponse.json({ error: err?.message ?? 'Erro ao reembolsar' }, { status: 502 })
  }
}
