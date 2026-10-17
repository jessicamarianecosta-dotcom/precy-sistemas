import crypto from 'crypto'
import type { PaymentAdapter, CatalogOrderForCharge, ChargeResult, PaymentWebhookEvent, WebhookRequest } from './types'

/**
 * Integração real com o Mercado Pago via Checkout Pro (API de Preferências):
 * o cliente é redirecionado para uma página hospedada pelo Mercado Pago que
 * já oferece PIX, cartão e boleto automaticamente, sem precisar implementar
 * cada meio de pagamento separadamente. Lê MERCADOPAGO_ACCESS_TOKEN /
 * MERCADOPAGO_WEBHOOK_SECRET / MERCADOPAGO_BASE_URL de env.
 *
 * Endpoints e validação de assinatura conferidos contra a documentação
 * oficial (checkout/preferences, v1/payments, validação de x-signature via
 * manifest "id:...;request-id:...;ts:...;" com HMAC-SHA256). Os nomes de
 * campo da resposta de /checkout/preferences (init_point/sandbox_init_point)
 * seguem o contrato documentado publicamente — ainda assim, teste com uma
 * conta de teste do Mercado Pago antes de liberar pagamentos reais.
 */
export class MercadoPagoAdapter implements PaymentAdapter {
  private accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? ''
  private webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''
  private baseUrl = (process.env.MERCADOPAGO_BASE_URL ?? 'https://api.mercadopago.com').replace(/\/$/, '')

  async createCharge(order: CatalogOrderForCharge): Promise<ChargeResult> {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const notificationUrl = appUrl ? `${appUrl}/api/webhooks/mercadopago` : undefined
    const returnUrl = appUrl && order.returnPath ? `${appUrl}${order.returnPath}` : undefined

    const res = await fetch(`${this.baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        items: [{
          title: order.description,
          quantity: 1,
          unit_price: Math.round(order.amount * 100) / 100,
          currency_id: 'BRL',
        }],
        payer: order.customerName ? { name: order.customerName } : undefined,
        external_reference: order.ref,
        notification_url: notificationUrl,
        ...(returnUrl ? { back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl }, auto_return: 'approved' } : {}),
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Mercado Pago: falha ao criar preferência de pagamento (${res.status}) ${errBody}`.trim())
    }

    const data = await res.json()
    const isProd = process.env.VERCEL_ENV === 'production'
    // Em produção usa init_point (credencial real); fora de produção prefere
    // sandbox_init_point (credencial de teste), caindo para init_point se o
    // Mercado Pago não devolver um sandbox (ex: credencial já é de produção).
    const redirectUrl = isProd ? data.init_point : (data.sandbox_init_point ?? data.init_point)

    return { ref: order.ref, redirectUrl, status: 'pending' }
  }

  verifyWebhookSignature(req: WebhookRequest): boolean {
    if (!this.webhookSecret) return false
    const sigHeader = req.headers['x-signature']
    if (!sigHeader) return false

    const parts: Record<string, string> = {}
    for (const piece of sigHeader.split(',')) {
      const [k, v] = piece.split('=').map(s => s.trim())
      if (k && v) parts[k] = v
    }
    if (!parts.ts || !parts.v1) return false

    const dataId = (req.searchParams.get('data.id') ?? req.searchParams.get('id') ?? '').toLowerCase()
    const requestId = req.headers['x-request-id'] ?? ''

    // Manifest oficial: "id:{data.id};request-id:{x-request-id};ts:{ts};" —
    // um valor ausente faz o segmento inteiro ser omitido (não fica vazio).
    const segments: string[] = []
    if (dataId) segments.push(`id:${dataId}`)
    if (requestId) segments.push(`request-id:${requestId}`)
    segments.push(`ts:${parts.ts}`)
    const manifest = segments.map(s => `${s};`).join('')

    const expected = crypto.createHmac('sha256', this.webhookSecret).update(manifest).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))
    } catch {
      return false
    }
  }

  async parseWebhookEvent(req: WebhookRequest): Promise<PaymentWebhookEvent> {
    const body = req.rawBody ? JSON.parse(req.rawBody) : {}
    const paymentId = body?.data?.id ?? req.searchParams.get('data.id') ?? req.searchParams.get('id')

    if (!paymentId) {
      // Mercado Pago manda outros tipos de notificação além de "payment"
      // (ex: merchant_order) — sem id de pagamento, não há o que confirmar.
      return { ref: '', status: 'pending', amount: 0, paymentMethod: null, raw: body }
    }

    const res = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
    if (!res.ok) {
      throw new Error(`Mercado Pago: falha ao consultar pagamento ${paymentId} (${res.status})`)
    }
    const payment = await res.json()

    const statusMap: Record<string, PaymentWebhookEvent['status']> = {
      approved: 'paid',
      pending: 'pending',
      in_process: 'pending',
      in_mediation: 'pending',
      rejected: 'failed',
      cancelled: 'failed',
      refunded: 'failed',
      charged_back: 'failed',
    }

    return {
      ref: payment.external_reference ?? '',
      status: statusMap[String(payment.status ?? '').toLowerCase()] ?? 'pending',
      amount: Number(payment.transaction_amount ?? 0),
      paymentMethod: payment.payment_method_id ?? payment.payment_type_id ?? null,
      raw: payment,
    }
  }
}
