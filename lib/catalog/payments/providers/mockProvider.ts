import { randomUUID } from 'crypto'
import { getFeeRule } from '../feeRules'
import { computeGrossAmount } from '../feeCalculator'
import type {
  PaymentGateway, AccountStatus, CreatePixPaymentParams, PixPaymentResult,
  CreateCardPaymentParams, CardPaymentResult, PaymentStatusResult, RefundResult,
  WebhookRequest, WebhookNotification,
} from '../types'

/**
 * Gateway de desenvolvimento — simula o fluxo completo (conexão, Pix,
 * cartão, reembolso) sem chamar o Mercado Pago, para testar o módulo sem
 * credenciais reais. NUNCA usado em produção (ver lib/catalog/payments/index.ts).
 */
export class MockPaymentGateway implements PaymentGateway {
  getConnectUrl(companyId: string): string {
    return `/loja/pagamento-mock/conectar?company_id=${companyId}`
  }

  async handleOAuthCallback(): Promise<AccountStatus> {
    return { connected: true, providerUserId: 'mock-user', publicKey: 'TEST-mock-public-key', liveMode: false, connectedAt: new Date().toISOString() }
  }

  async disconnectAccount(): Promise<void> {}

  async getAccountStatus(): Promise<AccountStatus> {
    return { connected: true, providerUserId: 'mock-user', publicKey: 'TEST-mock-public-key', liveMode: false, connectedAt: new Date().toISOString() }
  }

  async createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
    const rule = await getFeeRule(params.companyId, 'pix', 1)
    return {
      providerPaymentId: `mock_${randomUUID()}`,
      status: 'pending',
      grossAmount: params.netAmount,
      netAmount: params.netAmount,
      feeAmount: Number((params.netAmount * rule.feePercent + rule.feeFixed).toFixed(2)),
      feePercentSnapshot: rule.feePercent,
      feeFixedSnapshot: rule.feeFixed,
      qrCode: '00020126330014BR.GOV.BCB.PIX-MOCK-QR-CODE',
      qrCodeBase64: null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      raw: { mock: true, ref: params.checkoutRef },
    }
  }

  async createCardPayment(params: CreateCardPaymentParams): Promise<CardPaymentResult> {
    const rule = await getFeeRule(params.companyId, 'credit_card', params.installments)
    const grossAmount = computeGrossAmount(params.netAmount, rule)
    return {
      providerPaymentId: `mock_${randomUUID()}`,
      status: 'approved',
      grossAmount,
      netAmount: params.netAmount,
      feeAmount: Number((grossAmount - params.netAmount).toFixed(2)),
      feePercentSnapshot: rule.feePercent,
      feeFixedSnapshot: rule.feeFixed,
      installments: params.installments,
      statusDetail: 'accredited',
      raw: { mock: true, ref: params.checkoutRef },
    }
  }

  async getPaymentStatus(_companyId: string, providerPaymentId: string): Promise<PaymentStatusResult> {
    return { providerPaymentId, checkoutRef: null, status: 'approved', amount: 0, paymentMethod: null, installments: null, raw: { mock: true } }
  }

  async refundPayment(): Promise<RefundResult> {
    return { providerRefundId: `mock_refund_${randomUUID()}`, status: 'approved', raw: { mock: true } }
  }

  verifyWebhookSignature(): boolean {
    return true
  }

  parseWebhookNotification(req: WebhookRequest): WebhookNotification {
    let body: any = {}
    try { body = req.rawBody ? JSON.parse(req.rawBody) : {} } catch { /* ignore */ }
    return { topic: body.topic ?? 'payment', providerPaymentId: body.providerPaymentId ?? null, companyId: body.companyId ?? req.searchParams.get('company_id') }
  }
}
