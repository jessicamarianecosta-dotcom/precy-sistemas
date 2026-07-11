import type { ShippingAdapter, ShippingItem, ShippingQuote } from './types'

/**
 * Adapter de desenvolvimento — tabela de preço fixa por faixa de CEP,
 * usada enquanto as credenciais reais da SuperFrete não existem
 * (SUPERFRETE_MODE=mock ou SUPERFRETE_API_KEY ausente).
 */
export class MockShippingAdapter implements ShippingAdapter {
  async quote(cep: string, items: ShippingItem[]): Promise<ShippingQuote[]> {
    const totalWeight = items.reduce((s, i) => s + i.weightKg * i.quantity, 0)
    const base = 18 + totalWeight * 4
    return [
      { service: 'PAC (simulado)',      price: Number(base.toFixed(2)),        days: 7 },
      { service: 'SEDEX (simulado)',    price: Number((base * 1.8).toFixed(2)), days: 3 },
    ]
  }
}
