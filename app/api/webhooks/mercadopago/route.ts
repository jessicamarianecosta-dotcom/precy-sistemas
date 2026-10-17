import { NextRequest, NextResponse } from 'next/server'
import { getPaymentAdapter } from '@/lib/catalog/payments'
import { applyCatalogPaymentConfirmed } from '@/lib/orders/catalogPaymentCascade'

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/mercadopago
 *
 * Confirma o pagamento de um pedido do Catálogo Online feito via Mercado
 * Pago. Diferente da InfinityPay (que mandava status/valor direto no
 * corpo), o Mercado Pago só avisa QUAL pagamento mudou — o adapter busca os
 * detalhes reais (status/valor/external_reference) via GET
 * /v1/payments/{id} antes de confirmar (lib/catalog/payments/mercadopago.ts).
 *
 * A cascata pós-pagamento (Financeiro/Clientes/Estoque/Agenda) é a mesma
 * para qualquer gateway — ver lib/orders/catalogPaymentCascade.ts, onde
 * também vive a trava de idempotência contra reenvios do webhook.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  let adapter
  try {
    adapter = getPaymentAdapter()
  } catch (err: any) {
    console.error('[webhook/mercadopago] adapter indisponível:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Pagamentos indisponíveis' }, { status: 500 })
  }

  // Modo mock não verifica assinatura de verdade (qualquer POST com um ref
  // válido confirma o pagamento) — só é alcançável fora de produção
  // (getPaymentAdapter já falha explicitamente em produção sem credenciais).
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    console.warn('[webhook/mercadopago] MERCADOPAGO_ACCESS_TOKEN ausente — rodando em modo mock, sem verificação real de assinatura')
  }

  const ctx = {
    rawBody,
    headers: {
      'x-signature': req.headers.get('x-signature'),
      'x-request-id': req.headers.get('x-request-id'),
    },
    searchParams: req.nextUrl.searchParams,
  }

  if (!adapter.verifyWebhookSignature(ctx)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  let event
  try {
    event = await adapter.parseWebhookEvent(ctx)
  } catch (err: any) {
    console.error('[webhook/mercadopago] falha ao consultar pagamento:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro ao consultar pagamento' }, { status: 502 })
  }

  // Notificações sem referência (ex: tipos diferentes de "payment", como
  // merchant_order) ou com status ainda não pago não disparam a cascata.
  if (!event.ref || event.status !== 'paid') {
    return NextResponse.json({ received: true, status: event.status })
  }

  const result = await applyCatalogPaymentConfirmed(event, 'mercadopago')

  if (!result.ok) {
    if (result.status === 'not_found') {
      console.warn('[webhook/mercadopago] pedido não encontrado para ref', event.ref)
      return NextResponse.json({ received: true, warning: result.warning })
    }
    console.error('[webhook/mercadopago] cascata pós-pagamento falhou:', result.error)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  if ('alreadyProcessed' in result) {
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }

  return NextResponse.json({ received: true, orderId: result.orderId })
}
