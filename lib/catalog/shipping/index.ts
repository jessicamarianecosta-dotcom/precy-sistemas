import { MockShippingAdapter } from './mock'
import { SuperFreteAdapter } from './superfrete'
import type { ShippingAdapter } from './types'

export type {
  ShippingAdapter, ShippingItem, ShippingQuote, ShippingAddress, ShippingRecipient,
  CreateShipmentInput, ShipmentResult,
} from './types'

/**
 * Mesma regra de segurança de lib/catalog/payments/index.ts: em produção
 * (VERCEL_ENV=production) o mock nunca é usado — ele geraria cotações e
 * "etiquetas" fictícias sem nenhuma integração real. Falha explicitamente
 * em vez de cair silenciosamente no mock.
 */
export function getShippingAdapter(): ShippingAdapter {
  const mode = process.env.SUPERFRETE_MODE
  const hasCredentials = !!process.env.SUPERFRETE_API_KEY
  const isProdEnv = process.env.VERCEL_ENV === 'production'

  if (isProdEnv && (mode === 'mock' || !hasCredentials)) {
    throw new Error(
      'Frete do Catálogo Online desabilitado: SUPERFRETE_API_KEY não configurada em produção.'
    )
  }

  if (mode === 'mock' || !hasCredentials) return new MockShippingAdapter()
  return new SuperFreteAdapter()
}
