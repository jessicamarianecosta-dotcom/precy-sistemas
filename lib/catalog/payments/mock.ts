import type { PaymentAdapter, CatalogOrderForCharge, ChargeResult, PaymentWebhookEvent } from './types'

/**
 * Adapter de desenvolvimento — simula aprovação imediata sem chamar nenhuma
 * API externa. Usado enquanto as credenciais reais da InfinityPay não
 * existem (INFINITYPAY_MODE=mock ou INFINITYPAY_API_KEY ausente), permitindo
 * testar o checkout e a cascata pós-pagamento ponta-a-ponta.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  async createCharge(order: CatalogOrderForCharge): Promise<ChargeResult> {
    return { ref: order.ref, status: 'pending', redirectUrl: `/loja/pagamento-mock?ref=${encodeURIComponent(order.ref)}` }
  }

  verifyWebhookSignature(): boolean {
    return true
  }

  parseWebhookEvent(rawBody: string): PaymentWebhookEvent {
    const body = JSON.parse(rawBody)
    return {
      ref: body.ref,
      status: body.status ?? 'paid',
      amount: Number(body.amount ?? 0),
      paymentMethod: body.paymentMethod ?? 'mock',
      raw: body,
    }
  }
}
