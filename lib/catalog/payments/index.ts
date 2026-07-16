import { MockPaymentAdapter } from './mock'
import { InfinityPayAdapter } from './infinitypay'
import type { PaymentAdapter } from './types'

export type { PaymentAdapter, CatalogOrderForCharge, ChargeResult, PaymentWebhookEvent } from './types'

/**
 * Modo mock explícito (INFINITYPAY_MODE=mock) ou implícito (sem API key
 * configurada ainda) — permite desenvolver/testar o módulo Catálogo Online
 * sem depender das credenciais reais da InfinityPay.
 *
 * Em produção (VERCEL_ENV=production), o mock NUNCA é usado — ele aceita
 * qualquer webhook como pagamento confirmado (verifyWebhookSignature
 * sempre true), então rodar em produção sem credenciais reais permitiria
 * qualquer pessoa "pagar" um pedido da loja de graça. Falha explicitamente
 * em vez de cair silenciosamente no mock.
 */
export function getPaymentAdapter(): PaymentAdapter {
  const mode = process.env.INFINITYPAY_MODE
  const hasCredentials = !!process.env.INFINITYPAY_API_KEY
  const isProdEnv = process.env.VERCEL_ENV === 'production'

  if (isProdEnv && (mode === 'mock' || !hasCredentials)) {
    throw new Error(
      'Pagamentos do Catálogo Online desabilitados: INFINITYPAY_API_KEY não configurada em produção.'
    )
  }

  if (mode === 'mock' || !hasCredentials) return new MockPaymentAdapter()
  return new InfinityPayAdapter()
}
