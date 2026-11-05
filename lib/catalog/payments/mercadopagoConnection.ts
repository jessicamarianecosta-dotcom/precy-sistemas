import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt, decrypt } from './crypto'

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000

interface ConnectionRow {
  id: string
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  token_expires_at: string | null
}

/**
 * Devolve o access_token (decifrado, em memória só pelo tempo da chamada)
 * da conexão Mercado Pago ATIVA da empresa, renovando via refresh_token
 * quando estiver perto de expirar. Nunca loga o valor decifrado. Devolve
 * null quando a empresa não tem conexão própria — quem chama decide como
 * tratar isso (nunca cair num token global/de outra empresa).
 */
export async function getActiveConnectionAccessToken(companyId: string): Promise<string | null> {
  const { data: connection } = await (supabaseAdmin.from('mercadopago_connections') as any)
    .select('id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('company_id', companyId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!connection) return null

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null
  const needsRefresh = expiresAt != null && expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS

  if (needsRefresh && connection.refresh_token_encrypted) {
    try {
      return await refreshConnectionToken(connection)
    } catch (err: any) {
      await (supabaseAdmin.from('mercadopago_connections') as any)
        .update({ status: 'error', last_error: err?.message ?? 'Falha ao renovar token do Mercado Pago', updated_at: new Date().toISOString() })
        .eq('id', connection.id)
      return null
    }
  }

  return decrypt(connection.access_token_encrypted)
}

async function refreshConnectionToken(connection: ConnectionRow): Promise<string> {
  const refreshToken = decrypt(connection.refresh_token_encrypted!)

  const res = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_APP_ID,
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Falha ao renovar token do Mercado Pago (${res.status}) ${body}`.trim())
  }

  const data = await res.json()
  const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null

  await (supabaseAdmin.from('mercadopago_connections') as any)
    .update({
      access_token_encrypted: encrypt(data.access_token),
      refresh_token_encrypted: data.refresh_token ? encrypt(data.refresh_token) : connection.refresh_token_encrypted,
      token_expires_at: expiresAt,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  return data.access_token
}
