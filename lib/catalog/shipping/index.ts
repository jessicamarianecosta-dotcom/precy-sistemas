import { MockShippingAdapter } from './mock'
import { SuperFreteAdapter } from './superfrete'
import type { ShippingAdapter } from './types'

export type { ShippingAdapter, ShippingItem, ShippingQuote } from './types'

export function getShippingAdapter(): ShippingAdapter {
  const mode = process.env.SUPERFRETE_MODE
  const hasCredentials = !!process.env.SUPERFRETE_API_KEY
  if (mode === 'mock' || !hasCredentials) return new MockShippingAdapter()
  return new SuperFreteAdapter()
}
