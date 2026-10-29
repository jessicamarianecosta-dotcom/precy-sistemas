export interface ShippingItem {
  weightKg: number
  lengthCm: number
  heightCm: number
  widthCm: number
  quantity: number
}

export interface ShippingQuote {
  service: string
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
