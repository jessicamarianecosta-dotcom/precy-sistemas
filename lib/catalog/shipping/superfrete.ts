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
  // Obrigatório pela API real — sem isso ela responde 200 com
  // "Nenhum frete válido encontrado para esse serviço" mesmo com origem,
  // destino e produto corretos. IDs: 1=PAC, 2=SEDEX, 17=Mini Envios.
  private services = process.env.SUPERFRETE_SERVICES ?? '1,2,17'

  async quote(cep: string, items: ShippingItem[], originCep?: string | null): Promise<ShippingQuote[]> {
    const from = (originCep || this.originCep || '').replace(/\D/g, '')
    if (!from) {
      throw new Error('CEP de origem da loja não configurado (Configurações › Endereço ou SUPERFRETE_ORIGIN_CEP).')
    }

    const res = await fetch(`${this.baseUrl}/api/v0/calculator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        // Exigido pela API da SuperFrete para identificar a aplicação (recusa
        // a requisição sem isso) — mesma variável já documentada no
        // .env.example, só não estava sendo enviada ainda.
        'User-Agent': process.env.SUPERFRETE_USER_AGENT || 'Precy+ (contato não configurado)',
      },
      body: JSON.stringify({
        from: { postal_code: from },
        to: { postal_code: cep },
        products: items.map(i => ({
          weight: i.weightKg, length: i.lengthCm, height: i.heightCm, width: i.widthCm, quantity: i.quantity,
        })),
        services: this.services,
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
