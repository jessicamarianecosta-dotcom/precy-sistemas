export interface CatalogOrderForCharge {
  /** catalog_checkout_ref do pedido — usado para casar o webhook depois (idempotência). */
  ref: string
  amount: number
  customerName: string
  customerDocument?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
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

/** Dados devolvidos pelo Payment Brick (onSubmit) — já no formato aceito pela API de Pagamentos. */
export interface DirectPaymentFormData {
  payment_method_id: string
  token?: string
  installments?: number
  issuer_id?: string | number
  payer?: { email?: string; identification?: { type?: string; number?: string } }
}

export interface DirectPaymentPixData {
  /** Código "copia e cola". */
  qrCode: string
  /** Imagem do QR Code em base64 (sem o prefixo data:image). */
  qrCodeBase64: string
  ticketUrl?: string | null
}

export interface DirectPaymentResult {
  id: string
  status: string
  statusDetail?: string | null
  pix?: DirectPaymentPixData | null
}

export interface PaymentAdapter {
  createCharge(order: CatalogOrderForCharge): Promise<ChargeResult>
  /**
   * Pagamento inline (Pix/cartão via Payment Brick) — o valor SEMPRE vem de
   * `order.amount` (lido do pedido já criado no banco, nunca do client).
   * Devolve o status real que o gateway respondeu na hora; a confirmação
   * definitiva do pedido continua vindo só pelo webhook (verifyWebhookSignature
   * + parseWebhookEvent), nunca por esta resposta síncrona.
   */
  createDirectPayment(order: CatalogOrderForCharge, formData: DirectPaymentFormData): Promise<DirectPaymentResult>
  verifyWebhookSignature(req: WebhookRequest): boolean
  /**
   * Async porque alguns gateways (Mercado Pago) só mandam uma referência no
   * webhook — o adapter precisa buscar os detalhes reais do pagamento
   * (status/valor) numa chamada à API antes de devolver o evento.
   */
  parseWebhookEvent(req: WebhookRequest): Promise<PaymentWebhookEvent>
}
