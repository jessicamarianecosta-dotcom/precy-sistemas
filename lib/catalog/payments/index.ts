import { MockPaymentAdapter } from './mock'
import { MercadoPagoAdapter } from './mercadopago'
import { getActiveConnectionAccessToken } from './mercadopagoConnection'
import type { PaymentAdapter } from './types'

export type { PaymentAdapter, CatalogOrderForCharge, CardChargeInput, PaymentCreationResult, PaymentWebhookEvent, WebhookRequest } from './types'

/** Verdadeiro quando o adapter resolvido é o de desenvolvimento (sem
 *  credenciais reais) — usado pelo checkout da loja para decidir entre
 *  montar os Bricks reais do Mercado Pago ou cair na página de simulação. */
export function isMockAdapter(adapter: PaymentAdapter): boolean {
  return adapter instanceof MockPaymentAdapter
}

/**
 * Modo mock explícito (MERCADOPAGO_MODE=mock) ou implícito (sem token
 * configurado ainda) — permite desenvolver/testar o módulo Catálogo Online
 * sem depender das credenciais reais do Mercado Pago.
 *
 * Em produção (VERCEL_ENV=production), o mock NUNCA é usado — ele aceita
 * qualquer webhook como pagamento confirmado (verifyWebhookSignature
 * sempre true), então rodar em produção sem credenciais reais permitiria
 * qualquer pessoa "pagar" um pedido da loja de graça. Falha explicitamente
 * em vez de cair silenciosamente no mock.
 */
export function getPaymentAdapter(): PaymentAdapter {
  const mode = process.env.MERCADOPAGO_MODE
  const hasCredentials = !!process.env.MERCADOPAGO_ACCESS_TOKEN
  const isProdEnv = process.env.VERCEL_ENV === 'production'

  if (isProdEnv && (mode === 'mock' || !hasCredentials)) {
    throw new Error(
      'Pagamentos do Catálogo Online desabilitados: MERCADOPAGO_ACCESS_TOKEN não configurado em produção.'
    )
  }

  if (mode === 'mock' || !hasCredentials) return new MockPaymentAdapter()
  return new MercadoPagoAdapter()
}

/**
 * Modelo Marketplace: cada empresa cobra na PRÓPRIA conta do Mercado Pago,
 * conectada via OAuth em Catálogo > Pagamentos (mercadopago_connections).
 * Usada pelo checkout real e pelo webhook (que roteia por ?company_id= no
 * notification_url — ver MercadoPagoAdapter.createPayment).
 *
 * Nunca cai silenciosamente no MERCADOPAGO_ACCESS_TOKEN global como
 * fallback: sem conexão própria, falha explicitamente (mesma postura do
 * getPaymentAdapter() em produção) para não cobrar pedidos de uma empresa
 * na conta de outra. MERCADOPAGO_MODE=mock continua funcionando fora de
 * produção para desenvolvimento, sem precisar conectar nenhuma conta real.
 */
export async function getPaymentAdapterForCompany(companyId: string): Promise<PaymentAdapter> {
  const isProdEnv = process.env.VERCEL_ENV === 'production'
  if (!isProdEnv && process.env.MERCADOPAGO_MODE === 'mock') return new MockPaymentAdapter()

  const accessToken = await getActiveConnectionAccessToken(companyId)
  if (!accessToken) {
    throw new Error('Conecte sua conta Mercado Pago em Catálogo > Pagamentos para receber pagamentos online.')
  }

  return new MercadoPagoAdapter({
    accessToken,
    companyId,
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  })
}
