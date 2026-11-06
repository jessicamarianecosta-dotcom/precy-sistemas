import type { PaymentAdapter, CatalogOrderForCharge, CardChargeInput, PaymentCreationResult, PaymentWebhookEvent, WebhookRequest } from './types'

/**
 * Adapter de desenvolvimento — simula aprovação imediata sem chamar nenhuma
 * API externa. Usado enquanto as credenciais reais do Mercado Pago não
 * existem (MERCADOPAGO_MODE=mock ou MERCADOPAGO_ACCESS_TOKEN ausente),
 * permitindo testar o checkout e a cascata pós-pagamento ponta-a-ponta.
 *
 * Como não existe um paymentId real do Mercado Pago para alimentar o
 * Payment/Status Screen Brick, o checkout da loja detecta este adapter
 * (ver isMockAdapter) e cai de volta na página de simulação
 * /loja/pagamento-mock em vez de tentar montar os Bricks.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  async createPayment(order: CatalogOrderForCharge, _method: 'pix' | 'card', _card?: CardChargeInput): Promise<PaymentCreationResult> {
    return { ref: order.ref, paymentId: `mock-${order.ref}`, status: 'pending' }
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
