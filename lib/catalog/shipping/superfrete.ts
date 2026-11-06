import type { ShippingAdapter, ShippingItem, ShippingQuote } from './types'

// Lista padrão documentada pela própria SuperFrete para o parâmetro
// "services" do /api/v0/calculator (1: PAC, 2: SEDEX, 17: Mini Envios,
// 3: Jadlog, 31: Loggi, 33: J&T) — usada só como contingência se a
// consulta dinâmica de serviços (listServices) falhar, nunca como lista
// definitiva: a lista real e completa da conta vem sempre da API.
const DEFAULT_SERVICES = '1,2,17,3,31,33'

interface SuperFreteServiceInfo {
  name: string
  company?: { name?: string; picture?: string }
}

interface SuperFreteQuoteResponseItem {
  id: number
  name: string
  price: number | string
  delivery_time: number
  company?: { id?: number; name?: string; picture?: string }
  has_error?: boolean
  error?: string
}

/**
 * Integração real com a SuperFrete (POST /api/v0/calculator), conferida
 * contra a documentação oficial (https://superfrete.readme.io/reference/cotacao-de-frete).
 */
export class SuperFreteAdapter implements ShippingAdapter {
  private apiKey = process.env.SUPERFRETE_API_KEY ?? ''
  private originCep = process.env.SUPERFRETE_ORIGIN_CEP ?? ''
  private baseUrl = process.env.SUPERFRETE_BASE_URL ?? 'https://api.superfrete.com'
  private userAgent = process.env.SUPERFRETE_USER_AGENT || 'Precy+ (contato não configurado)'

  private authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      // Exigido pela API da SuperFrete para identificar a aplicação (recusa
      // a requisição sem isso).
      'User-Agent': this.userAgent,
    }
  }

  /**
   * GET /api/v0/services/info — catálogo completo das modalidades/transportadoras
   * habilitadas para a conta do token usado (Correios, Jadlog, Loggi, J&T...).
   * É assim que descobrimos TODAS as modalidades realmente disponíveis, sem
   * cadastrar transportadoras manualmente nem inventar uma lista fixa.
   */
  private async listServices(): Promise<Record<string, SuperFreteServiceInfo>> {
    const res = await fetch(`${this.baseUrl}/api/v0/services/info`, {
      method: 'GET',
      headers: this.authHeaders(),
    })
    if (!res.ok) {
      throw new Error(`SuperFrete: falha ao listar serviços disponíveis (${res.status})`)
    }
    return res.json()
  }

  async quote(cep: string, items: ShippingItem[], originCep?: string | null): Promise<ShippingQuote[]> {
    const from = (originCep || this.originCep || '').replace(/\D/g, '')
    if (!from) {
      throw new Error('CEP de origem da loja não configurado (Configurações › Endereço ou SUPERFRETE_ORIGIN_CEP).')
    }

    // Monta a lista de serviços a cotar a partir do que a própria conta tem
    // habilitado — nunca uma lista fixa escolhida por nós. Se a consulta
    // falhar (ex.: permissão do token), cai para a lista padrão documentada
    // pela SuperFrete como contingência, para o cálculo de frete não parar.
    let services = DEFAULT_SERVICES
    try {
      const available = await this.listServices()
      const ids = Object.keys(available)
      if (ids.length > 0) services = ids.join(',')
    } catch {
      services = DEFAULT_SERVICES
    }

    const res = await fetch(`${this.baseUrl}/api/v0/calculator`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        from: { postal_code: from },
        to: { postal_code: cep },
        products: items.map(i => ({
          weight: i.weightKg, length: i.lengthCm, height: i.heightCm, width: i.widthCm, quantity: i.quantity,
        })),
        services,
      }),
    })

    if (!res.ok) {
      throw new Error(`SuperFrete: falha ao calcular frete (${res.status})`)
    }

    const data: SuperFreteQuoteResponseItem[] = await res.json()
    return (Array.isArray(data) ? data : [])
      // has_error: a modalidade não está disponível para esta rota/pacote
      // (ex.: fora da área de cobertura) — não mostramos ao cliente.
      .filter(q => !q.has_error)
      .map(q => ({
        serviceId: q.id,
        service: q.name,
        carrier: q.company?.name ?? null,
        carrierLogo: q.company?.picture || null,
        price: Number(q.price),
        days: Number(q.delivery_time),
      }))
  }
}
