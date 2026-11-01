import { NextRequest, NextResponse } from 'next/server'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { applyCatalogPaymentConfirmed } from '@/lib/orders/catalogPaymentCascade'

export const runtime = 'nodejs'

const FAILED_STATUSES = new Set(['rejected', 'cancelled', 'expired'])

/**
 * POST /api/webhooks/mercadopago?company_id=...
 *
 * Uma loja por vez: o `company_id` vai na notification_url de cada
 * cobrança criada (lib/catalog/payments/providers/mercadoPagoProvider.ts),
 * então o webhook já sabe de qual loja é o pagamento sem precisar
 * adivinhar — e busca o detalhe do pagamento com o access_token DAQUELA
 * loja (cada loja tem sua própria conta conectada).
 *
 * Idempotência real: a trava é a combinação (provider, provider_payment_id,
 * status resultante) em payment_webhook_events (UNIQUE) — processa a MESMA
 * transição de status apenas uma vez, mas permite reprocessar quando o
 * status evolui (pending → approved → refunded), diferente de travar só
 * pelo id do pagamento.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const companyId = req.nextUrl.searchParams.get('company_id')

  let gateway
  try {
    gateway = getPaymentGateway()
  } catch (err: any) {
    console.error('[webhook/mercadopago] gateway indisponível:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Pagamentos indisponíveis' }, { status: 500 })
  }

  const ctx = {
    rawBody,
    headers: {
      'x-signature': req.headers.get('x-signature'),
      'x-request-id': req.headers.get('x-request-id'),
    },
    searchParams: req.nextUrl.searchParams,
  }

  if (!gateway.verifyWebhookSignature(ctx)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  const notification = gateway.parseWebhookNotification(ctx)

  // Mercado Pago manda outros tipos de notificação além de "payment" (ex:
  // merchant_order) — sem id de pagamento, não há o que confirmar.
  if (!notification.providerPaymentId) {
    return NextResponse.json({ received: true, ignored: notification.topic })
  }
  if (!companyId) {
    console.error('[webhook/mercadopago] notificação sem company_id na URL — não é possível identificar a loja', notification)
    return NextResponse.json({ received: true, warning: 'company_id ausente' })
  }

  let statusResult
  try {
    statusResult = await gateway.getPaymentStatus(companyId, notification.providerPaymentId)
  } catch (err: any) {
    console.error('[webhook/mercadopago] falha ao consultar pagamento:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro ao consultar pagamento' }, { status: 502 })
  }

  // Grava o evento ANTES de processar — se já existir a mesma transição
  // (provider, provider_payment_id, status), o INSERT falha com 23505 e o
  // processamento é pulado (evita duplicar o registro financeiro).
  const { error: insertError } = await (supabaseAdmin.from('payment_webhook_events') as any)
    .insert([{
      provider: 'mercadopago',
      provider_payment_id: notification.providerPaymentId,
      resulting_status: statusResult.status,
      payload: { notification, body: safeParse(rawBody) },
      processing_status: 'received',
    }])

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }
    console.error('[webhook/mercadopago] falha ao registrar evento:', insertError.message)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { data: payment } = await (supabaseAdmin.from('payments') as any)
    .select('id, order_id, checkout_ref, payment_method')
    .eq('provider', 'mercadopago')
    .eq('provider_payment_id', notification.providerPaymentId)
    .maybeSingle()

  if (!payment) {
    console.warn('[webhook/mercadopago] pagamento não encontrado na tabela payments para', notification.providerPaymentId)
    await markEventProcessed(notification.providerPaymentId, 'ignored', 'payment não encontrado localmente')
    return NextResponse.json({ received: true, warning: 'payment não encontrado' })
  }

  await (supabaseAdmin.from('payments') as any)
    .update({ status: statusResult.status, raw_response: statusResult.raw })
    .eq('id', payment.id)

  try {
    if (statusResult.status === 'approved') {
      const result = await applyCatalogPaymentConfirmed(
        { ref: payment.checkout_ref, status: 'paid', amount: statusResult.amount, paymentMethod: payment.payment_method, raw: statusResult.raw },
        'mercadopago',
      )
      if (!result.ok && result.status === 'error') throw new Error(result.error)
    } else if (FAILED_STATUSES.has(statusResult.status)) {
      await (supabaseAdmin.from('orders') as any)
        .update({ payment_status: statusResult.status === 'expired' ? 'expired' : (statusResult.status === 'cancelled' ? 'cancelled' : 'failed') })
        .eq('id', payment.order_id)
    } else if (statusResult.status === 'refunded') {
      await (supabaseAdmin.from('orders') as any).update({ payment_status: 'refunded' }).eq('id', payment.order_id)
      await (supabaseAdmin.from('payment_refunds') as any)
        .update({ status: 'approved' })
        .eq('payment_id', payment.id)
        .eq('status', 'pending')
    }
  } catch (err: any) {
    console.error('[webhook/mercadopago] falha ao processar cascata:', err?.message ?? err)
    await markEventProcessed(notification.providerPaymentId, 'error', err?.message ?? String(err))
    return NextResponse.json({ error: err?.message ?? 'Erro ao processar pagamento' }, { status: 500 })
  }

  await markEventProcessed(notification.providerPaymentId, 'processed', null)
  return NextResponse.json({ received: true, orderId: payment.order_id, status: statusResult.status })
}

async function markEventProcessed(providerPaymentId: string, status: 'processed' | 'ignored' | 'error', errorMessage: string | null) {
  await (supabaseAdmin.from('payment_webhook_events') as any)
    .update({ processing_status: status, error_message: errorMessage })
    .eq('provider', 'mercadopago')
    .eq('provider_payment_id', providerPaymentId)
    .eq('processing_status', 'received')
}

function safeParse(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return null }
}
