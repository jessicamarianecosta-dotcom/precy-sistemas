import { NextRequest, NextResponse } from 'next/server'
import { getPaymentAdapter, getPaymentAdapterForCompany } from '@/lib/catalog/payments'
import { applyCatalogPaymentConfirmed } from '@/lib/orders/catalogPaymentCascade'
import { applyMontagemPaymentConfirmed, MONTAGEM_REF_PREFIX } from '@/lib/montagem/licenseCascade'

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
 * Modelo Marketplace: cada empresa cobra na própria conta MP, então o
 * adapter usado aqui precisa ser o DAQUELA empresa (token OAuth próprio),
 * nunca um token global — por isso a notification_url configurada em
 * MercadoPagoAdapter.createCharge carrega ?company_id=..., usado para
 * resolver a conexão certa antes de consultar o pagamento.
 *
 * A cascata pós-pagamento (Financeiro/Clientes/Estoque/Agenda) é a mesma
 * para qualquer gateway — ver lib/orders/catalogPaymentCascade.ts, onde
 * também vive a trava de idempotência contra reenvios do webhook.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const companyId = req.nextUrl.searchParams.get('company_id')

  let adapter
  try {
    // Sem company_id na notificação (ex: preferência antiga, ou ambiente de
    // desenvolvimento em modo mock) cai no adapter padrão — que em produção
    // sem credenciais globais falha explicitamente, nunca cobra silenciosamente.
    adapter = companyId ? await getPaymentAdapterForCompany(companyId) : getPaymentAdapter()
  } catch (err: any) {
    console.error('[webhook/mercadopago] adapter indisponível:', err?.message)
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

  // Compra avulsa do Precy Montagem (produto da própria Precy+, não um
  // pedido de loja de empresa cliente) — cascata separada, sem passar pelo
  // fluxo de pedidos do Catálogo Online.
  if (event.ref.startsWith(MONTAGEM_REF_PREFIX)) {
    const montagemResult = await applyMontagemPaymentConfirmed(event)
    if (!montagemResult.ok) {
      if (montagemResult.status === 'not_found') {
        console.warn('[webhook/mercadopago] licença não encontrada para ref', event.ref)
        return NextResponse.json({ received: true, warning: montagemResult.warning })
      }
      console.error('[webhook/mercadopago] falha ao confirmar licença do Montagem:', montagemResult.error)
      return NextResponse.json({ error: montagemResult.error }, { status: 500 })
    }
    return NextResponse.json({ received: true, licenseId: montagemResult.licenseId, alreadyProcessed: montagemResult.alreadyProcessed })
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
