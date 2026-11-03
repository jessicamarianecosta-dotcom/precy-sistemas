import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'
import { signState } from '@/lib/catalog/payments/crypto'

/**
 * GET /api/mercadopago/oauth/connect
 *
 * Início do fluxo OAuth Marketplace: redireciona o dono da loja para a
 * página do Mercado Pago onde ele autoriza o Precy+ a cobrar na PRÓPRIA
 * conta dele (modelo Marketplace via Checkout Pro). O retorno cai em
 * app/api/mercadopago/oauth/callback/route.ts.
 *
 * O `state` é assinado (lib/catalog/payments/crypto.ts) e amarra o
 * callback ao company_id de quem iniciou a conexão aqui — nunca confiar em
 * company_id vindo da query string do callback.
 */
export async function GET() {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const appId = process.env.MERCADOPAGO_APP_ID
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  if (!appId || !appUrl) {
    return NextResponse.json(
      { error: 'Integração com Mercado Pago ainda não configurada (MERCADOPAGO_APP_ID pendente de liberação no painel do Mercado Pago).' },
      { status: 503 }
    )
  }

  const state = signState({ companyId: auth.companyId, ts: Date.now(), nonce: randomUUID() })
  const redirectUri = `${appUrl}/api/mercadopago/oauth/callback`

  const authUrl = new URL('https://auth.mercadopago.com.br/authorization')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('platform_id', 'mp')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(authUrl.toString())
}
