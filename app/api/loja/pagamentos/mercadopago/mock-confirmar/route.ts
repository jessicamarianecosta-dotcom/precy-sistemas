import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { applyCatalogPaymentConfirmed } from '@/lib/orders/catalogPaymentCascade'

export const runtime = 'nodejs'

/**
 * POST /api/loja/pagamentos/mercadopago/mock-confirmar
 * Body: { checkoutRef: string }
 *
 * Só existe para desenvolvimento sem credenciais reais (MERCADOPAGO_MODE=mock
 * ou sem MERCADOPAGO_APP_ID): simula a aprovação assíncrona de uma cobrança
 * Pix criada pelo MockPaymentGateway, chamando a mesma cascata pós-pagamento
 * que o webhook real chamaria. Em produção com credenciais reais,
 * getPaymentGateway() nunca devolve o mock — a rota falha explicitamente.
 */
export async function POST(req: NextRequest) {
  const gateway = getPaymentGateway()
  if (gateway.constructor.name !== 'MockPaymentGateway') {
    return NextResponse.json({ error: 'Disponível apenas em modo de desenvolvimento (mock)' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const checkoutRef = String(body?.checkoutRef ?? '')
  if (!checkoutRef) return NextResponse.json({ error: 'checkoutRef é obrigatório' }, { status: 400 })

  const { data: payment } = await (supabaseAdmin.from('payments') as any)
    .select('id, order_id, payment_method, amount')
    .eq('checkout_ref', checkoutRef)
    .maybeSingle()
  if (!payment) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })

  await (supabaseAdmin.from('payments') as any).update({ status: 'approved' }).eq('id', payment.id)

  const result = await applyCatalogPaymentConfirmed(
    { ref: checkoutRef, status: 'paid', amount: payment.amount, paymentMethod: payment.payment_method, raw: { mock: true } },
    'mercadopago',
  )
  if (!result.ok && result.status === 'error') {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
