import { NextRequest, NextResponse } from 'next/server'
import { verifyState, encrypt } from '@/lib/notasFiscais/crypto'
import { BLING_OAUTH_TOKEN_URL } from '@/lib/notasFiscais/blingConnection'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/bling/oauth/callback
 *
 * Troca o `code` do Bling por access_token/refresh_token (POST
 * /Api/v3/oauth/token, Basic auth client_id:client_secret) e grava a
 * conexão cifrada em bling_connections, uma linha por empresa (ON
 * CONFLICT company_id). Sempre redireciona de volta para Notas Fiscais,
 * com sucesso ou erro em query string — nunca expõe token nenhum na URL
 * de volta. Mesmo desenho de app/api/mercadopago/oauth/callback/route.ts.
 */
export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  function redirectBack(status: 'success' | 'error', message?: string) {
    const url = new URL(`${appUrl}/notas-fiscais`)
    url.searchParams.set('bling', status)
    if (message) url.searchParams.set('bling_msg', message)
    return NextResponse.redirect(url.toString())
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  if (errorParam) return redirectBack('error', 'Autorização cancelada no Bling')
  if (!code || !state) return redirectBack('error', 'Resposta inválida do Bling')

  const payload = verifyState(state)
  if (!payload || typeof payload.companyId !== 'string') {
    return redirectBack('error', 'Sessão de conexão expirada — tente novamente')
  }
  const companyId = payload.companyId

  const clientId = process.env.BLING_CLIENT_ID
  const clientSecret = process.env.BLING_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return redirectBack('error', 'Integração com Bling ainda não configurada')
  }

  const redirectUri = `${appUrl}/api/bling/oauth/callback`
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  let tokenRes: Response
  try {
    tokenRes = await fetch(BLING_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: '1.0', // formato exato do header na doc oficial do Bling
        Authorization: `Basic ${basicAuth}`,
        // Token opaco está sendo descontinuado pelo Bling — enable-jwt precisa ir
        // desde a primeira obtenção de token pra já recebermos o formato JWT.
        'enable-jwt': '1',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
  } catch {
    return redirectBack('error', 'Falha de comunicação com o Bling')
  }

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '')
    console.error('[bling/oauth/callback] falha ao trocar code por token:', tokenRes.status, body)
    return redirectBack('error', 'Não foi possível concluir a conexão com o Bling')
  }

  const data = await tokenRes.json()
  const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null

  const { error } = await (supabaseAdmin.from('bling_connections') as any)
    .upsert([{
      company_id: companyId,
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
    console.error('[bling/oauth/callback] falha ao salvar conexão:', error.message)
    return redirectBack('error', 'Conexão recebida, mas falhou ao salvar — tente novamente')
  }

  return redirectBack('success')
}
