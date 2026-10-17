import type { PaymentAdapter, CatalogOrderForCharge, ChargeResult, PaymentWebhookEvent, WebhookRequest } from './types'

/**
 * Adapter de desenvolvimento — simula aprovação imediata sem chamar nenhuma
 * API externa. Usado enquanto as credenciais reais do Mercado Pago não
 * existem (MERCADOPAGO_MODE=mock ou MERCADOPAGO_ACCESS_TOKEN ausente),
 * permitindo testar o checkout e a cascata pós-pagamento ponta-a-ponta.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  async createCharge(order: CatalogOrderForCharge): Promise<ChargeResult> {
    return { ref: order.ref, status: 'pending', redirectUrl: `/loja/pagamento-mock?ref=${encodeURIComponent(order.ref)}` }
  }

  verifyWebhookSignature(): boolean {
    return true
  }

  async parseWebhookEvent(req: WebhookRequest): Promise<PaymentWebhookEvent> {
    const body = req.rawBody ? JSON.parse(req.rawBody) : {}
    return {
      ref: body.ref,
      status: body.status ?? 'paid',
      amount: Number(body.amount ?? 0),
      paymentMethod: body.paymentMethod ?? 'mock',
      raw: body,
    }
  }
}
