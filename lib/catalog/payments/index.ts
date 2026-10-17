import { MockPaymentAdapter } from './mock'
import { MercadoPagoAdapter } from './mercadopago'
import type { PaymentAdapter } from './types'

export type { PaymentAdapter, CatalogOrderForCharge, ChargeResult, PaymentWebhookEvent, WebhookRequest } from './types'

/**
 * Modo mock explícito (MERCADOPAGO_MODE=mock) ou implícito (sem token
 * configurado ainda) — permite desenvolver/testar o módulo Catálogo Online
 * sem depender das credenciais reais do Mercado Pago.
 *
 * Em produção (VERCEL_ENV=production), o mock NUNCA é usado — ele aceita
 * qualquer webhook como pagamento confirmado (verifyWebhookSignature
 * sempre true), então rodar em produção sem credenciais reais permitiria
 * qualquer pessoa "pagar" um pedido da loja de graça. Falha explicitamente
 * em vez de cair silenciosamente no mock.
 */
export function getPaymentAdapter(): PaymentAdapter {
  const mode = process.env.MERCADOPAGO_MODE
  const hasCredentials = !!process.env.MERCADOPAGO_ACCESS_TOKEN
  const isProdEnv = process.env.VERCEL_ENV === 'production'

  if (isProdEnv && (mode === 'mock' || !hasCredentials)) {
    throw new Error(
      'Pagamentos do Catálogo Online desabilitados: MERCADOPAGO_ACCESS_TOKEN não configurado em produção.'
    )
  }

  if (mode === 'mock' || !hasCredentials) return new MockPaymentAdapter()
  return new MercadoPagoAdapter()
}
