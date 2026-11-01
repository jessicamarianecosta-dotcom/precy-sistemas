export type PaymentMethodKind = 'pix' | 'credit_card'

export type PaymentStatus =
  | 'pending' | 'in_process' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'expired'

export interface AccountStatus {
  connected: boolean
  providerUserId?: string | null
  publicKey?: string | null
  liveMode?: boolean
  connectedAt?: string | null
  lastError?: string | null
}

export interface CreatePixPaymentParams {
  companyId: string
  checkoutRef: string
  /** Valor LÍQUIDO desejado pela loja (preço no Pix) — o gateway cobra exatamente isso, sem acréscimo. */
  netAmount: number
  description: string
  customerName: string
  customerEmail?: string | null
  customerDocument?: string | null
}

export interface PixPaymentResult {
  providerPaymentId: string
  status: PaymentStatus
  grossAmount: number
  netAmount: number
  feeAmount: number
  feePercentSnapshot: number
  feeFixedSnapshot: number
  qrCode: string | null
  qrCodeBase64: string | null
  expiresAt: string | null
  raw: unknown
}

export interface CreateCardPaymentParams {
  companyId: string
  checkoutRef: string
  /** Valor LÍQUIDO desejado pela loja — o valor bruto (com acréscimo do parcelamento) é calculado aqui dentro. */
  netAmount: number
  installments: number
  cardToken: string
  paymentMethodId: string
  description: string
  customerName: string
  customerEmail?: string | null
  customerDocument?: string | null
  customerDocumentType?: string | null
}

export interface CardPaymentResult {
  providerPaymentId: string
  status: PaymentStatus
  grossAmount: number
  netAmount: number
  feeAmount: number
  feePercentSnapshot: number
  feeFixedSnapshot: number
  installments: number
  statusDetail?: string | null
  raw: unknown
}

export interface PaymentStatusResult {
  providerPaymentId: string
  checkoutRef: string | null
  status: PaymentStatus
  amount: number
  paymentMethod: PaymentMethodKind | null
  installments: number | null
  raw: unknown
}

export interface RefundResult {
  providerRefundId: string | null
  status: 'approved' | 'pending' | 'rejected'
  raw: unknown
}

export interface WebhookRequest {
  rawBody: string
  headers: Record<string, string | null>
  searchParams: URLSearchParams
}

export interface WebhookNotification {
  topic: string
  providerPaymentId: string | null
  companyId: string | null
}

export interface PaymentGateway {
  /** URL para redirecionar o lojista autorizar a conexão da conta (OAuth). */
  getConnectUrl(companyId: string, state: string, redirectUri: string): string
  /** Troca o "code" do callback OAuth pelos tokens de acesso e grava (criptografados) em store_payment_accounts. */
  handleOAuthCallback(companyId: string, code: string, redirectUri: string): Promise<AccountStatus>
  disconnectAccount(companyId: string): Promise<void>
  getAccountStatus(companyId: string): Promise<AccountStatus>
  createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult>
  createCardPayment(params: CreateCardPaymentParams): Promise<CardPaymentResult>
  getPaymentStatus(companyId: string, providerPaymentId: string): Promise<PaymentStatusResult>
  refundPayment(companyId: string, providerPaymentId: string, amount?: number): Promise<RefundResult>
  verifyWebhookSignature(req: WebhookRequest): boolean
  parseWebhookNotification(req: WebhookRequest): WebhookNotification
}
