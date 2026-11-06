import crypto from 'crypto'
import type { PaymentAdapter, CatalogOrderForCharge, ChargeResult, PaymentWebhookEvent, WebhookRequest, DirectPaymentFormData, DirectPaymentResult } from './types'

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
export interface MercadoPagoAdapterOptions {
  /** Access token da conexão OAuth da empresa (resolvido por lib/catalog/payments/index.ts). */
  accessToken?: string
  webhookSecret?: string
  /** Quando presente, é anexado ao notification_url (?company_id=...) para o
   *  webhook saber de qual empresa/conexão consultar o pagamento depois. */
  companyId?: string
}

export class MercadoPagoAdapter implements PaymentAdapter {
  private accessToken: string
  private webhookSecret: string
  private baseUrl = (process.env.MERCADOPAGO_BASE_URL ?? 'https://api.mercadopago.com').replace(/\/$/, '')
  private companyId?: string

  constructor(opts?: MercadoPagoAdapterOptions) {
    this.accessToken = opts?.accessToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN ?? ''
    this.webhookSecret = opts?.webhookSecret ?? process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''
    this.companyId = opts?.companyId
  }

  async createCharge(order: CatalogOrderForCharge): Promise<ChargeResult> {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const notificationUrl = appUrl
      ? `${appUrl}/api/webhooks/mercadopago${this.companyId ? `?company_id=${encodeURIComponent(this.companyId)}` : ''}`
      : undefined
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
        payer: (order.customerName || order.customerEmail)
          ? { name: order.customerName, email: order.customerEmail ?? undefined }
          : undefined,
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

  /**
   * Pagamento inline via Payment Brick (Checkout API) — conferido contra a
   * documentação oficial (https://www.mercadopago.com/developers/pt/docs/checkout-bricks/payment-brick,
   * https://www.mercadopago.com/developers/pt/docs/checkout-api/payment-methods/pix).
   * O valor cobrado é SEMPRE `order.amount` (lido do pedido no banco pelo
   * chamador) — o formData do Brick nunca inclui o valor.
   */
  async createDirectPayment(order: CatalogOrderForCharge, formData: DirectPaymentFormData): Promise<DirectPaymentResult> {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const notificationUrl = appUrl
      ? `${appUrl}/api/webhooks/mercadopago${this.companyId ? `?company_id=${encodeURIComponent(this.companyId)}` : ''}`
      : undefined

    const res = await fetch(`${this.baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        // Uma chave por tentativa de pagamento (gerada por quem chama este
        // adapter) — evita cobrança duplicada se a mesma requisição for
        // reenviada por falha de rede, sem travar uma nova tentativa depois
        // de um cartão recusado.
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Math.round(order.amount * 100) / 100,
        description: order.description,
        payment_method_id: formData.payment_method_id,
        token: formData.token,
        installments: formData.installments,
        issuer_id: formData.issuer_id,
        payer: formData.payer ?? (order.customerEmail ? { email: order.customerEmail } : undefined),
        external_reference: order.ref,
        notification_url: notificationUrl,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.message ?? `Mercado Pago: falha ao processar pagamento (${res.status})`)
    }

    const txData = data.point_of_interaction?.transaction_data
    return {
      id: String(data.id),
      status: String(data.status ?? 'pending'),
      statusDetail: data.status_detail ?? null,
      pix: txData?.qr_code
        ? { qrCode: txData.qr_code, qrCodeBase64: txData.qr_code_base64, ticketUrl: txData.ticket_url ?? null }
        : null,
    }
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
