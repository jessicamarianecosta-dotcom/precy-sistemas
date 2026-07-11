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
  quote(cep: string, items: ShippingItem[]): Promise<ShippingQuote[]>
}
