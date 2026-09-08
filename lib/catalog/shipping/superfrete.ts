import type {
  ShippingAdapter, ShippingItem, ShippingQuote, CreateShipmentInput, ShipmentResult,
} from './types'

/**
 * Integração real com a SuperFrete (API v0 — https://superfrete.com.br/api).
 * Cotação (`/api/v0/calculator`) e contratação de envio + etiqueta
 * (`/api/v0/cart` → adiciona ao carrinho, `/api/v0/checkout` → paga com
 * saldo da conta, `/api/v0/generate` → gera a etiqueta/rastreio).
 * Nomes de endpoint/payload conferidos contra a documentação pública da
 * SuperFrete; revisar de novo se a API deles mudar de versão.
 */
export class SuperFreteAdapter implements ShippingAdapter {
  private apiKey = process.env.SUPERFRETE_API_KEY ?? ''
  private baseUrl = process.env.SUPERFRETE_BASE_URL ?? 'https://api.superfrete.com'

  private headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': 'Precy+ (contato@precyplus.com.br)',
    }
  }

  async quote(originCep: string, destCep: string, items: ShippingItem[]): Promise<ShippingQuote[]> {
    const res = await fetch(`${this.baseUrl}/api/v0/calculator`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        from: { postal_code: originCep },
        to: { postal_code: destCep },
        products: items.map(i => ({
          weight: i.weightKg, length: i.lengthCm, height: i.heightCm, width: i.widthCm, quantity: i.quantity,
        })),
      }),
    })

    if (!res.ok) {
      throw new Error(`SuperFrete: falha ao calcular frete (${res.status})`)
    }

    const data = await res.json()
    const quotes = data.quotes ?? data ?? []
    return quotes
      .filter((q: any) => !q.error)
      .map((q: any) => ({
        service: q.name ?? q.service,
        serviceId: q.id != null ? String(q.id) : undefined,
        price: Number(q.price),
        days: Number(q.delivery_time ?? q.days),
      }))
  }

  /**
   * Contrata o envio escolhido e gera a etiqueta. A SuperFrete separa isso
   * em 3 chamadas (carrinho → pagamento com saldo da conta → geração da
   * etiqueta); aqui elas são encadeadas numa única operação atômica do
   * ponto de vista do chamador — se qualquer etapa falhar, nenhuma etiqueta
   * fica "meio criada" sem estar registrada no pedido (quem chama só grava
   * em order_shipments depois que este método retorna com sucesso).
   */
  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    if (!input.serviceId) {
      throw new Error('SuperFrete: serviço de envio (serviceId) é obrigatório para gerar etiqueta')
    }

    const cartRes = await fetch(`${this.baseUrl}/api/v0/cart`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        service: Number(input.serviceId),
        from: {
          name: input.from.name,
          document: input.from.document,
          phone: input.from.phone,
          postal_code: input.from.cep,
          address: input.from.street,
          number: input.from.number,
          complement: input.from.complement ?? undefined,
          district: input.from.district,
          city: input.from.city,
          state_abbr: input.from.state,
        },
        to: {
          name: input.to.name,
          document: input.to.document ?? undefined,
          phone: input.to.phone,
          postal_code: input.to.cep,
          address: input.to.street,
          number: input.to.number,
          complement: input.to.complement ?? undefined,
          district: input.to.district,
          city: input.to.city,
          state_abbr: input.to.state,
        },
        products: input.items.map(i => ({
          weight: i.weightKg, length: i.lengthCm, height: i.heightCm, width: i.widthCm, quantity: i.quantity,
        })),
        order_id: input.orderRef,
      }),
    })

    if (!cartRes.ok) {
      throw new Error(`SuperFrete: falha ao adicionar envio ao carrinho (${cartRes.status})`)
    }
    const cart = await cartRes.json()
    const cartId = cart.id ?? cart.order_id ?? cart[0]?.id
    if (!cartId) {
      throw new Error('SuperFrete: resposta do carrinho sem id do envio')
    }

    const checkoutRes = await fetch(`${this.baseUrl}/api/v0/checkout`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ orders: [cartId] }),
    })
    if (!checkoutRes.ok) {
      throw new Error(`SuperFrete: falha ao pagar/confirmar o envio (${checkoutRes.status})`)
    }
    const checkoutData = await checkoutRes.json().catch(() => null)

    const generateRes = await fetch(`${this.baseUrl}/api/v0/generate`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ orders: [cartId] }),
    })
    if (!generateRes.ok) {
      throw new Error(`SuperFrete: falha ao gerar a etiqueta (${generateRes.status})`)
    }
    const generated = await generateRes.json()
    const shipmentData = Array.isArray(generated) ? generated[0] : (generated.orders?.[0] ?? generated)

    return {
      providerShipmentId: String(cartId),
      trackingCode: shipmentData?.tracking ?? null,
      trackingUrl: shipmentData?.tracking
        ? `https://superfrete.com.br/rastreio/${shipmentData.tracking}`
        : null,
      labelUrl: shipmentData?.url ?? shipmentData?.label_url ?? null,
      status: 'generated',
      raw: { cart, checkout: checkoutData, generated },
    }
  }
}
