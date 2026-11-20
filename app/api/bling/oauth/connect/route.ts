import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { signState } from '@/lib/notasFiscais/crypto'

/**
 * GET /api/bling/oauth/connect
 *
 * Início do fluxo OAuth com o Bling: redireciona a usuária para a página
 * do Bling onde ela autoriza o Precy+ a operar a API na própria conta
 * dela. O retorno cai em app/api/bling/oauth/callback/route.ts. Mesmo
 * desenho de app/api/mercadopago/oauth/connect/route.ts.
 *
 * O `state` é assinado (lib/notasFiscais/crypto.ts) e amarra o callback
 * ao company_id de quem iniciou a conexão aqui — nunca confiar em
 * company_id vindo da query string do callback.
 */
export async function GET() {
  const auth = await requireNotasFiscaisAccess()
  if (!auth.ok) return auth.response

  const clientId = process.env.BLING_CLIENT_ID
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  if (!clientId || !appUrl) {
    return NextResponse.json(
      { error: 'Integração com Bling ainda não configurada (BLING_CLIENT_ID pendente — ver lib/notasFiscais/README.md).' },
      { status: 503 }
    )
  }

  const state = signState({ companyId: auth.companyId, ts: Date.now(), nonce: randomUUID() })
  const redirectUri = `${appUrl}/api/bling/oauth/callback`

  const authUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(authUrl.toString())
}
