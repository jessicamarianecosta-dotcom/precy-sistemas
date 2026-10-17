export interface CatalogOrderForCharge {
  /** catalog_checkout_ref do pedido — usado para casar o webhook depois (idempotência). */
  ref: string
  amount: number
  customerName: string
  customerDocument?: string | null
  customerPhone?: string | null
  description: string
  /** Caminho (ex: "/loja/lumilife") para onde o gateway deve redirecionar o
   *  cliente após o pagamento, quando o gateway suportar back_urls. */
  returnPath?: string | null
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

/**
 * Dados brutos da requisição de webhook recebida — um objeto só (em vez de
 * (rawBody, signatureHeader) como antes) porque gateways diferentes exigem
 * contexto diferente para validar a assinatura e identificar o pagamento:
 * a InfinityPay só precisa de um header, o Mercado Pago precisa também do
 * header x-request-id e do "data.id" que vem na query string da notificação.
 */
export interface WebhookRequest {
  rawBody: string
  /** Headers relevantes, em minúsculo (ex: "x-signature", "x-request-id"). */
  headers: Record<string, string | null>
  searchParams: URLSearchParams
}

export interface PaymentAdapter {
  createCharge(order: CatalogOrderForCharge): Promise<ChargeResult>
  verifyWebhookSignature(req: WebhookRequest): boolean
  /**
   * Async porque alguns gateways (Mercado Pago) só mandam uma referência no
   * webhook — o adapter precisa buscar os detalhes reais do pagamento
   * (status/valor) numa chamada à API antes de devolver o evento.
   */
  parseWebhookEvent(req: WebhookRequest): Promise<PaymentWebhookEvent>
}
