import { NextRequest, NextResponse } from 'next/server'
import { verifyState, encrypt } from '@/lib/catalog/payments/crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/mercadopago/oauth/callback
 *
 * Troca o `code` do Mercado Pago por access_token/refresh_token
 * (POST /oauth/token) e grava a conexão cifrada em mercadopago_connections,
 * uma linha por empresa (ON CONFLICT company_id). Sempre redireciona de
 * volta para Catálogo > Pagamentos, com sucesso ou erro em query string —
 * nunca expõe token nenhum na URL de volta.
 */
export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  function redirectBack(status: 'success' | 'error', message?: string) {
    const url = new URL(`${appUrl}/catalogo`)
    url.searchParams.set('aba', 'pagamentos')
    url.searchParams.set('mp', status)
    if (message) url.searchParams.set('mp_msg', message)
    return NextResponse.redirect(url.toString())
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  if (errorParam) return redirectBack('error', 'Autorização cancelada no Mercado Pago')
  if (!code || !state) return redirectBack('error', 'Resposta inválida do Mercado Pago')

  const payload = verifyState(state)
  if (!payload || typeof payload.companyId !== 'string') {
    return redirectBack('error', 'Sessão de conexão expirada — tente novamente')
  }
  const companyId = payload.companyId

  const appId = process.env.MERCADOPAGO_APP_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  if (!appId || !clientSecret) {
    return redirectBack('error', 'Integração com Mercado Pago ainda não configurada')
  }

  const redirectUri = `${appUrl}/api/mercadopago/oauth/callback`

  let tokenRes: Response
  try {
    tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
  } catch {
    return redirectBack('error', 'Falha de comunicação com o Mercado Pago')
  }

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '')
    console.error('[mercadopago/oauth/callback] falha ao trocar code por token:', tokenRes.status, body)
    return redirectBack('error', 'Não foi possível concluir a conexão com o Mercado Pago')
  }

  const data = await tokenRes.json()
  const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null

  // Apelido da conta MP conectada, só para exibição na UI — best-effort,
  // a conexão não deixa de ser salva se essa chamada falhar.
  let nickname: string | null = null
  try {
    const meRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    if (meRes.ok) {
      const me = await meRes.json()
      nickname = me.nickname ?? null
    }
  } catch {
    // ignora — nickname é só cosmético
  }

  const { error } = await (supabaseAdmin.from('mercadopago_connections') as any)
    .upsert([{
      company_id: companyId,
      mp_user_id: String(data.user_id ?? ''),
      mp_public_key: data.public_key ?? null,
      mp_nickname: nickname,
      live_mode: data.live_mode ?? true,
      access_token_encrypted: encrypt(data.access_token),
      refresh_token_encrypted: data.refresh_token ? encrypt(data.refresh_token) : null,
      token_expires_at: expiresAt,
      scopes: data.scope ?? null,
      status: 'connected',
      last_error: null,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'company_id' })

  if (error) {
    console.error('[mercadopago/oauth/callback] falha ao salvar conexão:', error.message)
    return redirectBack('error', 'Conexão recebida, mas falhou ao salvar — tente novamente')
  }

  return redirectBack('success')
}
