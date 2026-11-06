export interface ShippingItem {
  weightKg: number
  lengthCm: number
  heightCm: number
  widthCm: number
  quantity: number
}

export interface ShippingQuote {
  /** Código do serviço na SuperFrete (ex.: 1 = PAC, 2 = SEDEX). */
  serviceId?: number
  /** Nome do serviço/modalidade (ex.: "PAC", "SEDEX", "Mini Envios"). */
  service: string
  /** Nome da transportadora (ex.: "Correios", "Jadlog", "Loggi"). */
  carrier?: string | null
  /** URL do logo da transportadora, quando a API devolve um. */
  carrierLogo?: string | null
  price: number
  days: number
}

export interface ShippingAdapter {
  /**
   * @param originCep CEP de origem da loja (catalog_settings.zip_code da
   * empresa). Quando ausente, o adapter cai para SUPERFRETE_ORIGIN_CEP (env).
   */
  quote(cep: string, items: ShippingItem[], originCep?: string | null): Promise<ShippingQuote[]>
}
