import crypto from 'crypto'
import { getFeeRule } from '../feeRules'
import { computeGrossAmount } from '../feeCalculator'
import { getStoreAccount, saveStoreAccount, markAccountDisconnected, getAccountStatusRow, markAccountError } from '../storeAccounts'
import type {
  PaymentGateway, AccountStatus, CreatePixPaymentParams, PixPaymentResult,
  CreateCardPaymentParams, CardPaymentResult, PaymentStatusResult, RefundResult,
  WebhookRequest, WebhookNotification, PaymentStatus,
} from '../types'

const MP_STATUS_MAP: Record<string, PaymentStatus> = {
  approved: 'approved',
  pending: 'pending',
  in_process: 'in_process',
  in_mediation: 'in_process',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
}

/**
 * Integração multi-tenant com o Mercado Pago (Checkout Transparente —
 * Payments API) usando OAuth: cada loja autoriza a própria conta e os
 * pagamentos criados em nome dela são cobrados e liquidados DIRETAMENTE na
 * conta Mercado Pago da própria loja (o access_token usado em toda chamada
 * de cobrança é o da loja, nunca o da plataforma) — não é um split 1:N com
 * comissão retida pelo Precy, é "marketplace" apenas no sentido de que o
 * Precy conecta a conta, não processa a cobrança no lugar dela.
 *
 * Credenciais necessárias (variáveis de ambiente):
 *   MERCADOPAGO_APP_ID / MERCADOPAGO_CLIENT_SECRET — da APLICAÇÃO do Precy
 *     no Mercado Pago (painel do desenvolvedor → Suas integrações →
 *     aplicação OAuth), usadas só para o handshake OAuth (autorizar e
 *     trocar o "code" por token). Exigem a aplicação cadastrada com a
 *     redirect_uri de produção.
 *   MERCADOPAGO_WEBHOOK_SECRET — chave de assinatura configurada em
 *     Webhooks dessa MESMA aplicação (não por loja — todas as notificações
 *     de todas as lojas conectadas chegam assinadas com essa chave).
 */
export class MercadoPagoProvider implements PaymentGateway {
  private appId = process.env.MERCADOPAGO_APP_ID ?? ''
  private clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET ?? ''
  private webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''
  private baseUrl = (process.env.MERCADOPAGO_BASE_URL ?? 'https://api.mercadopago.com').replace(/\/$/, '')

  private notificationUrl(companyId: string): string | undefined {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    return appUrl ? `${appUrl}/api/webhooks/mercadopago?company_id=${encodeURIComponent(companyId)}` : undefined
  }

  getConnectUrl(companyId: string, state: string, redirectUri: string): string {
    if (!this.appId) throw new Error('MERCADOPAGO_APP_ID não configurado — a conexão de contas exige a aplicação OAuth do Precy cadastrada no Mercado Pago.')
    const url = new URL('https://auth.mercadopago.com.br/authorization')
    url.searchParams.set('client_id', this.appId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('platform_id', 'mp')
    url.searchParams.set('state', state)
    url.searchParams.set('redirect_uri', redirectUri)
    return url.toString()
  }

  async handleOAuthCallback(companyId: string, code: string, redirectUri: string): Promise<AccountStatus> {
    if (!this.appId || !this.clientSecret) {
      throw new Error('MERCADOPAGO_APP_ID/MERCADOPAGO_CLIENT_SECRET não configurados — não é possível concluir a conexão.')
    }
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.appId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`Mercado Pago: falha ao autorizar a conta (${res.status}) ${data?.message ?? ''}`.trim())
    }

    await saveStoreAccount(companyId, {
      providerUserId: data.user_id != null ? String(data.user_id) : null,
      publicKey: data.public_key ?? null,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresInSeconds: data.expires_in ?? null,
      scope: data.scope ?? null,
      liveMode: data.live_mode !== false,
    })

    return this.getAccountStatus(companyId)
  }

  async disconnectAccount(companyId: string): Promise<void> {
    // O Mercado Pago não expõe um endpoint público de revogação para
    // aplicações OAuth de marketplace — desconectar localmente (apagar os
    // tokens) já impede qualquer cobrança nova por aqui; a própria loja
    // pode revogar o acesso do lado dela em Mercado Pago → Configurações →
    // Aplicações conectadas, se quiser revogar também do lado deles.
    await markAccountDisconnected(companyId)
  }

  async getAccountStatus(companyId: string): Promise<AccountStatus> {
    return getAccountStatusRow(companyId)
  }

  /** Troca o refresh_token por um access_token novo quando o atual estiver perto de expirar. */
  private async ensureFreshToken(companyId: string) {
    const account = await getStoreAccount(companyId)
    if (!account) throw new Error('Loja sem conta Mercado Pago conectada.')

    const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : null
    const needsRefresh = expiresAt != null && expiresAt - Date.now() < 24 * 60 * 60 * 1000
    if (!needsRefresh || !account.refreshToken) return account

    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.appId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      await markAccountError(companyId, 'mercadopago', `Falha ao renovar token: ${data?.message ?? res.status}`)
      // Token antigo pode ainda funcionar até expirar de verdade — não bloqueia a cobrança atual.
      return account
    }

    await saveStoreAccount(companyId, {
      providerUserId: data.user_id != null ? String(data.user_id) : account.providerUserId,
      publicKey: data.public_key ?? account.publicKey,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? account.refreshToken,
      expiresInSeconds: data.expires_in ?? null,
      scope: data.scope ?? null,
      liveMode: account.liveMode,
    })
    return { ...account, accessToken: data.access_token }
  }

  async createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
    const account = await this.ensureFreshToken(params.companyId)
    const rule = await getFeeRule(params.companyId, 'pix', 1)

    // Regra comercial: o preço cadastrado é o preço no Pix — o cliente paga
    // exatamente netAmount, sem acréscimo. feeAmount aqui é só a estimativa
    // do custo do gateway que a LOJA absorve (não é cobrado do cliente).
    const res = await fetch(`${this.baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${account.accessToken}`,
        'X-Idempotency-Key': params.checkoutRef,
      },
      body: JSON.stringify({
        transaction_amount: params.netAmount,
        description: params.description,
        payment_method_id: 'pix',
        external_reference: params.checkoutRef,
        notification_url: this.notificationUrl(params.companyId),
        payer: {
          email: params.customerEmail || 'cliente@precyplus.com.br',
          first_name: params.customerName,
          identification: params.customerDocument
            ? { type: params.customerDocument.length > 11 ? 'CNPJ' : 'CPF', number: params.customerDocument.replace(/\D/g, '') }
            : undefined,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`Mercado Pago: falha ao gerar cobrança Pix (${res.status}) ${data?.message ?? JSON.stringify(data?.cause ?? '')}`.trim())
    }

    const txData = data?.point_of_interaction?.transaction_data
    return {
      providerPaymentId: String(data.id),
      status: MP_STATUS_MAP[String(data.status)] ?? 'pending',
      grossAmount: params.netAmount,
      netAmount: params.netAmount,
      feeAmount: Number((params.netAmount * rule.feePercent + rule.feeFixed).toFixed(2)),
      feePercentSnapshot: rule.feePercent,
      feeFixedSnapshot: rule.feeFixed,
      qrCode: txData?.qr_code ?? null,
      qrCodeBase64: txData?.qr_code_base64 ?? null,
      expiresAt: data.date_of_expiration ?? null,
      raw: data,
    }
  }

  async createCardPayment(params: CreateCardPaymentParams): Promise<CardPaymentResult> {
    const account = await this.ensureFreshToken(params.companyId)
    const rule = await getFeeRule(params.companyId, 'credit_card', params.installments)
    const grossAmount = computeGrossAmount(params.netAmount, rule)

    const res = await fetch(`${this.baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${account.accessToken}`,
        'X-Idempotency-Key': `${params.checkoutRef}:card:${params.installments}`,
      },
      body: JSON.stringify({
        transaction_amount: grossAmount,
        token: params.cardToken,
        installments: params.installments,
        payment_method_id: params.paymentMethodId,
        description: params.description,
        external_reference: params.checkoutRef,
        notification_url: this.notificationUrl(params.companyId),
        payer: {
          email: params.customerEmail || 'cliente@precyplus.com.br',
          identification: params.customerDocument
            ? { type: params.customerDocumentType ?? (params.customerDocument.length > 11 ? 'CNPJ' : 'CPF'), number: params.customerDocument.replace(/\D/g, '') }
            : undefined,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`Mercado Pago: falha ao processar cartão (${res.status}) ${data?.message ?? JSON.stringify(data?.cause ?? '')}`.trim())
    }

    return {
      providerPaymentId: String(data.id),
      status: MP_STATUS_MAP[String(data.status)] ?? 'pending',
      grossAmount,
      netAmount: params.netAmount,
      feeAmount: Number((grossAmount - params.netAmount).toFixed(2)),
      feePercentSnapshot: rule.feePercent,
      feeFixedSnapshot: rule.feeFixed,
      installments: params.installments,
      statusDetail: data.status_detail ?? null,
      raw: data,
    }
  }

  async getPaymentStatus(companyId: string, providerPaymentId: string): Promise<PaymentStatusResult> {
    const account = await this.ensureFreshToken(companyId)
    const res = await fetch(`${this.baseUrl}/v1/payments/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    })
    if (!res.ok) throw new Error(`Mercado Pago: falha ao consultar pagamento ${providerPaymentId} (${res.status})`)
    const data = await res.json()
    return {
      providerPaymentId: String(data.id),
      checkoutRef: data.external_reference ?? null,
      status: MP_STATUS_MAP[String(data.status)] ?? 'pending',
      amount: Number(data.transaction_amount ?? 0),
      paymentMethod: data.payment_type_id === 'credit_card' ? 'credit_card' : (data.payment_method_id === 'pix' ? 'pix' : null),
      installments: data.installments ?? null,
      raw: data,
    }
  }

  async refundPayment(companyId: string, providerPaymentId: string, amount?: number): Promise<RefundResult> {
    const account = await this.ensureFreshToken(companyId)
    const res = await fetch(`${this.baseUrl}/v1/payments/${providerPaymentId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${account.accessToken}`,
      },
      body: amount != null ? JSON.stringify({ amount }) : JSON.stringify({}),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`Mercado Pago: falha ao reembolsar (${res.status}) ${data?.message ?? ''}`.trim())
    }
    return {
      providerRefundId: data.id != null ? String(data.id) : null,
      status: data.status === 'approved' ? 'approved' : (data.status === 'rejected' ? 'rejected' : 'pending'),
      raw: data,
    }
  }

  verifyWebhookSignature(req: WebhookRequest): boolean {
    if (!this.webhookSecret) return false
    const sigHeader = req.headers['x-signature']
    if (!sigHeader) return false

    const parts: Record<string, string> = {}
    for (const piece of sigHeader.split(',')) {
      const [k, v] = piece.split('=').map(s => s.trim())
      if (k && v) parts[k] = v
    }
    if (!parts.ts || !parts.v1) return false

    const dataId = (req.searchParams.get('data.id') ?? req.searchParams.get('id') ?? '').toLowerCase()
    const requestId = req.headers['x-request-id'] ?? ''

    const segments: string[] = []
    if (dataId) segments.push(`id:${dataId}`)
    if (requestId) segments.push(`request-id:${requestId}`)
    segments.push(`ts:${parts.ts}`)
    const manifest = segments.map(s => `${s};`).join('')

    const expected = crypto.createHmac('sha256', this.webhookSecret).update(manifest).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))
    } catch {
      return false
    }
  }

  parseWebhookNotification(req: WebhookRequest): WebhookNotification {
    let body: any = {}
    try { body = req.rawBody ? JSON.parse(req.rawBody) : {} } catch { /* notificação sem corpo JSON válido */ }
    const topic = String(body?.type ?? req.searchParams.get('topic') ?? req.searchParams.get('type') ?? '')
    const providerPaymentId = body?.data?.id != null ? String(body.data.id) : (req.searchParams.get('data.id') ?? req.searchParams.get('id') ?? null)
    const companyId = req.searchParams.get('company_id')
    return { topic, providerPaymentId, companyId }
  }
}
