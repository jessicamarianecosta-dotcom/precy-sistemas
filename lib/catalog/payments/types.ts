export interface CatalogOrderForCharge {
  /** catalog_checkout_ref do pedido — usado para casar o webhook depois (idempotência). */
  ref: string
  amount: number
  customerName: string
  customerDocument?: string | null
  customerPhone?: string | null
  description: string
}

export interface ChargeResult {
  ref: string
  redirectUrl?: string
  qrCode?: string
  status: 'pending' | 'paid'
}

export interface PaymentWebhookEvent {
  ref: string
  status: 'paid' | 'failed' | 'pending'
  amount: number
  paymentMethod?: string | null
  raw: unknown
}

export interface PaymentAdapter {
  createCharge(order: CatalogOrderForCharge): Promise<ChargeResult>
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean
  parseWebhookEvent(rawBody: string): PaymentWebhookEvent
}
