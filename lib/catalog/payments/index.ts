import { MockPaymentAdapter } from './mock'
import { InfinityPayAdapter } from './infinitypay'
import type { PaymentAdapter } from './types'

export type { PaymentAdapter, CatalogOrderForCharge, ChargeResult, PaymentWebhookEvent } from './types'

/**
 * Modo mock explícito (INFINITYPAY_MODE=mock) ou implícito (sem API key
 * configurada ainda) — permite desenvolver/testar o módulo Catálogo Online
 * sem depender das credenciais reais da InfinityPay.
 */
export function getPaymentAdapter(): PaymentAdapter {
  const mode = process.env.INFINITYPAY_MODE
  const hasCredentials = !!process.env.INFINITYPAY_API_KEY
  if (mode === 'mock' || !hasCredentials) return new MockPaymentAdapter()
  return new InfinityPayAdapter()
}
