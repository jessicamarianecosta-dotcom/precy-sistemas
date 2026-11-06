import crypto from 'crypto'
import type { PaymentAdapter, CatalogOrderForCharge, CardChargeInput, PaymentCreationResult, PaymentWebhookEvent, WebhookRequest } from './types'

/**
 * Integração real com o Mercado Pago via Payments API (/v1/payments) usada
 * diretamente pelo Payment Brick do checkout da loja — sem redirecionar o
 * cliente para fora do site. Só dois meios de pagamento são oferecidos: Pix
 * e cartão de crédito (ver customization.paymentMethods no Brick, que já
 * exclui boleto, cartão pré-pago/débito e saldo em conta Mercado Pago).
 * Lê MERCADOPAGO_ACCESS_TOKEN / MERCADOPAGO_WEBHOOK_SECRET /
 * MERCADOPAGO_BASE_URL de env.
 *
 * Endpoints e validação de assinatura conferidos contra a documentação
 * oficial (v1/payments, validação de x-signature via manifest
 * "id:...;request-id:...;ts:...;" com HMAC-SHA256, campos point_of_interaction
 * .transaction_data.qr_code/qr_code_base64 da resposta de pagamento Pix) —
 * ainda assim, teste com uma conta de teste do Mercado Pago antes de liberar
 * pagamentos reais.
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

  private statusMap: Record<string, PaymentCreationResult['status']> = {
    approved: 'paid',
    pending: 'pending',
    in_process: 'pending',
    in_mediation: 'pending',
    authorized: 'pending',
    rejected: 'failed',
    cancelled: 'failed',
    refunded: 'failed',
    charged_back: 'failed',
  }

  /**
   * Divide nome completo em first_name/last_name (exigidos pela API em
   * alguns fluxos, ex: Pix) — aproximação razoável, o Mercado Pago não
   * valida esses campos contra documento oficial.
   */
  private splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/)
    return { firstName: parts[0] ?? fullName, lastName: parts.slice(1).join(' ') || parts[0] || fullName }
  }

  async createPayment(order: CatalogOrderForCharge, method: 'pix' | 'card', card?: CardChargeInput): Promise<PaymentCreationResult> {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const notificationUrl = appUrl
      ? `${appUrl}/api/webhooks/mercadopago${this.companyId ? `?company_id=${encodeURIComponent(this.companyId)}` : ''}`
      : undefined

    const { firstName, lastName } = this.splitName(order.customerName)
    const document = (order.customerDocument ?? '').replace(/\D/g, '')
    const payer: Record<string, unknown> = {
      email: order.customerEmail || undefined,
      first_name: firstName,
      last_name: lastName,
    }
    if (document) {
      payer.identification = { type: document.length > 11 ? 'CNPJ' : 'CPF', number: document }
    }

    const body: Record<string, unknown> = {
      transaction_amount: Math.round(order.amount * 100) / 100,
      description: order.description,
      external_reference: order.ref,
      notification_url: notificationUrl,
      payer,
    }

    if (method === 'pix') {
      body.payment_method_id = 'pix'
    } else {
      if (!card) throw new Error('Dados do cartão ausentes')
      body.token = card.token
      body.installments = card.installments
      body.payment_method_id = card.paymentMethodId
      if (card.issuerId) body.issuer_id = card.issuerId
    }

    const res = await fetch(`${this.baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        // Chave de idempotência — a mesma compra (checkoutRef) nunca gera
        // dois pagamentos mesmo que a requisição seja reenviada.
        'X-Idempotency-Key': order.ref,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      const detail = data?.message ?? data?.cause?.[0]?.description ?? (await res.text().catch(() => ''))
      throw new Error(`Mercado Pago: falha ao criar pagamento (${res.status}) ${detail}`.trim())
    }

    return {
      ref: order.ref,
      paymentId: String(data.id),
      status: this.statusMap[String(data.status ?? '').toLowerCase()] ?? 'pending',
      statusDetail: data.status_detail ?? null,
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

    return {
      ref: payment.external_reference ?? '',
      status: this.statusMap[String(payment.status ?? '').toLowerCase()] ?? 'pending',
      amount: Number(payment.transaction_amount ?? 0),
      paymentMethod: payment.payment_method_id ?? payment.payment_type_id ?? null,
      raw: payment,
    }
  }
}
