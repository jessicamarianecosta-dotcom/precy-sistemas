import { randomUUID } from 'crypto'
import type { ShippingAdapter, ShippingItem, ShippingQuote, CreateShipmentInput, ShipmentResult } from './types'

/**
 * Adapter de desenvolvimento — tabela de preço fixa por peso total,
 * usada enquanto as credenciais reais da SuperFrete não existem
 * (SUPERFRETE_MODE=mock ou SUPERFRETE_API_KEY ausente).
 */
export class MockShippingAdapter implements ShippingAdapter {
  async quote(_originCep: string, _destCep: string, items: ShippingItem[]): Promise<ShippingQuote[]> {
    const totalWeight = items.reduce((s, i) => s + i.weightKg * i.quantity, 0)
    const base = 18 + totalWeight * 4
    return [
      { service: 'PAC (simulado)', serviceId: 'pac-mock', price: Number(base.toFixed(2)), days: 7 },
      { service: 'SEDEX (simulado)', serviceId: 'sedex-mock', price: Number((base * 1.8).toFixed(2)), days: 3 },
    ]
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const id = randomUUID()
    return {
      providerShipmentId: `mock-${id}`,
      trackingCode: `MOCK${id.slice(0, 8).toUpperCase()}`,
      trackingUrl: null,
      labelUrl: null,
      status: 'generated',
      raw: { mock: true, orderRef: input.orderRef },
    }
  }
}
