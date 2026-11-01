import { MockPaymentGateway } from './providers/mockProvider'
import { MercadoPagoProvider } from './providers/mercadoPagoProvider'
import type { PaymentGateway } from './types'

export type * from './types'
export * from './feeCalculator'

/**
 * Modo mock explícito (MERCADOPAGO_MODE=mock) ou implícito (sem a
 * aplicação OAuth configurada ainda) — permite desenvolver/testar o
 * checkout do catálogo sem depender de credenciais reais do Mercado Pago.
 *
 * Em produção (VERCEL_ENV=production) o mock NUNCA é usado: falha
 * explicitamente em vez de aceitar qualquer webhook como pago.
 */
export function getPaymentGateway(): PaymentGateway {
  const mode = process.env.MERCADOPAGO_MODE
  const hasAppCredentials = !!process.env.MERCADOPAGO_APP_ID && !!process.env.MERCADOPAGO_CLIENT_SECRET
  const isProdEnv = process.env.VERCEL_ENV === 'production'

  if (isProdEnv && (mode === 'mock' || !hasAppCredentials)) {
    throw new Error(
      'Pagamentos do Catálogo Online desabilitados: MERCADOPAGO_APP_ID/MERCADOPAGO_CLIENT_SECRET não configurados em produção.'
    )
  }

  if (mode === 'mock' || !hasAppCredentials) return new MockPaymentGateway()
  return new MercadoPagoProvider()
}
