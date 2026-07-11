import crypto from 'crypto'
import type { PaymentAdapter, CatalogOrderForCharge, ChargeResult, PaymentWebhookEvent } from './types'

/**
 * Integração real com a InfinityPay (PIX/cartão/parcelamento). Estrutura
 * pronta para ligar assim que as credenciais/documentação chegarem — hoje
 * lê INFINITYPAY_API_KEY / INFINITYPAY_WEBHOOK_SECRET / INFINITYPAY_BASE_URL
 * de env. Os nomes de endpoint/payload abaixo são um ponto de partida
 * razoável e devem ser conferidos contra a documentação oficial da
 * InfinityPay antes de ir para produção.
 */
export class InfinityPayAdapter implements PaymentAdapter {
  private apiKey = process.env.INFINITYPAY_API_KEY ?? ''
  private webhookSecret = process.env.INFINITYPAY_WEBHOOK_SECRET ?? ''
  private baseUrl = process.env.INFINITYPAY_BASE_URL ?? 'https://api.infinitepay.io'

  async createCharge(order: CatalogOrderForCharge): Promise<ChargeResult> {
    const res = await fetch(`${this.baseUrl}/v2/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        order_id: order.ref,
        amount: Math.round(order.amount * 100),
        customer: { name: order.customerName, document: order.customerDocument, phone: order.customerPhone },
        description: order.description,
      }),
    })

    if (!res.ok) {
      throw new Error(`InfinityPay: falha ao criar cobrança (${res.status})`)
    }

    const data = await res.json()
    return {
      ref: order.ref,
      redirectUrl: data.checkout_url ?? data.url,
      qrCode: data.qr_code ?? data.pix_qr_code,
      status: 'pending',
    }
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!this.webhookSecret || !signatureHeader) return false
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
    } catch {
      return false
    }
  }

  parseWebhookEvent(rawBody: string): PaymentWebhookEvent {
    const body = JSON.parse(rawBody)
    const statusMap: Record<string, PaymentWebhookEvent['status']> = {
      paid: 'paid', approved: 'paid', completed: 'paid',
      failed: 'failed', canceled: 'failed', declined: 'failed',
    }
    return {
      ref: body.order_id ?? body.ref,
      status: statusMap[String(body.status ?? '').toLowerCase()] ?? 'pending',
      amount: Number(body.amount ?? 0) / 100,
      paymentMethod: body.payment_method ?? null,
      raw: body,
    }
  }
}
