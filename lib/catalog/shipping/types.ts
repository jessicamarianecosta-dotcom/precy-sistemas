export interface ShippingItem {
  weightKg: number
  lengthCm: number
  heightCm: number
  widthCm: number
  quantity: number
}

export interface ShippingQuote {
  service: string
  serviceId?: string
  price: number
  days: number
}

export interface ShippingOrigin {
  cep: string
}

export interface ShippingAddress {
  name: string
  document: string
  phone: string
  cep: string
  street: string
  number: string
  complement?: string | null
  district: string
  city: string
  state: string
}

export interface ShippingRecipient {
  name: string
  phone: string
  document?: string | null
  cep: string
  street: string
  number: string
  complement?: string | null
  district: string
  city: string
  state: string
}

export interface CreateShipmentInput {
  service: string
  serviceId?: string
  from: ShippingAddress
  to: ShippingRecipient
  items: ShippingItem[]
  orderRef: string
}

export interface ShipmentResult {
  providerShipmentId: string
  trackingCode: string | null
  trackingUrl: string | null
  labelUrl: string | null
  status: string
  raw: unknown
}

export interface ShippingAdapter {
  quote(originCep: string, destCep: string, items: ShippingItem[]): Promise<ShippingQuote[]>
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>
}
