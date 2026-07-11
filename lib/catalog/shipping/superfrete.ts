import type { ShippingAdapter, ShippingItem, ShippingQuote } from './types'

/**
 * Integração real com a SuperFrete. Estrutura pronta para ligar assim que
 * as credenciais chegarem — endpoint/payload devem ser conferidos contra a
 * documentação oficial antes de ir para produção.
 */
export class SuperFreteAdapter implements ShippingAdapter {
  private apiKey = process.env.SUPERFRETE_API_KEY ?? ''
  private originCep = process.env.SUPERFRETE_ORIGIN_CEP ?? ''
  private baseUrl = process.env.SUPERFRETE_BASE_URL ?? 'https://api.superfrete.com'

  async quote(cep: string, items: ShippingItem[]): Promise<ShippingQuote[]> {
    const res = await fetch(`${this.baseUrl}/api/v0/calculator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: { postal_code: this.originCep },
        to: { postal_code: cep },
        products: items.map(i => ({
          weight: i.weightKg, length: i.lengthCm, height: i.heightCm, width: i.widthCm, quantity: i.quantity,
        })),
      }),
    })

    if (!res.ok) {
      throw new Error(`SuperFrete: falha ao calcular frete (${res.status})`)
    }

    const data = await res.json()
    return (data.quotes ?? data ?? []).map((q: any) => ({
      service: q.name ?? q.service,
      price: Number(q.price),
      days: Number(q.delivery_time ?? q.days),
    }))
  }
}
