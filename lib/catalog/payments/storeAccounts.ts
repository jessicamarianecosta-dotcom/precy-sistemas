import { supabaseAdmin } from '@/lib/supabase/admin'
import { encryptToken, decryptToken } from './tokenCrypto'
import type { AccountStatus } from './types'

export interface StoredAccount {
  accessToken: string
  refreshToken: string | null
  providerUserId: string | null
  publicKey: string | null
  tokenExpiresAt: string | null
  liveMode: boolean
}

/** Lê a conta conectada da loja e já devolve os tokens descriptografados — uso exclusivo de rotas de servidor. */
export async function getStoreAccount(companyId: string, provider = 'mercadopago'): Promise<StoredAccount | null> {
  const { data, error } = await (supabaseAdmin.from('store_payment_accounts') as any)
    .select('access_token_encrypted, refresh_token_encrypted, provider_user_id, public_key, token_expires_at, live_mode, status')
    .eq('company_id', companyId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) throw new Error(`Erro ao consultar conta de pagamento: ${error.message}`)
  if (!data || data.status !== 'connected' || !data.access_token_encrypted) return null

  return {
    accessToken: decryptToken(data.access_token_encrypted),
    refreshToken: data.refresh_token_encrypted ? decryptToken(data.refresh_token_encrypted) : null,
    providerUserId: data.provider_user_id,
    publicKey: data.public_key,
    tokenExpiresAt: data.token_expires_at,
    liveMode: !!data.live_mode,
  }
}

export async function getAccountStatusRow(companyId: string, provider = 'mercadopago'): Promise<AccountStatus> {
  const { data, error } = await (supabaseAdmin.from('store_payment_accounts') as any)
    .select('provider_user_id, public_key, live_mode, status, connected_at, last_error')
    .eq('company_id', companyId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) throw new Error(`Erro ao consultar conta de pagamento: ${error.message}`)
  if (!data || data.status !== 'connected') {
    return { connected: false, lastError: data?.last_error ?? null }
  }
  return {
    connected: true,
    providerUserId: data.provider_user_id,
    publicKey: data.public_key,
    liveMode: !!data.live_mode,
    connectedAt: data.connected_at,
  }
}

export async function saveStoreAccount(companyId: string, params: {
  provider?: string
  providerUserId: string | null
  publicKey: string | null
  accessToken: string
  refreshToken: string | null
  expiresInSeconds: number | null
  scope: string | null
  liveMode: boolean
}) {
  const expiresAt = params.expiresInSeconds ? new Date(Date.now() + params.expiresInSeconds * 1000).toISOString() : null
  const { error } = await (supabaseAdmin.from('store_payment_accounts') as any)
    .upsert([{
      company_id: companyId,
      provider: params.provider ?? 'mercadopago',
      provider_user_id: params.providerUserId,
      public_key: params.publicKey,
      access_token_encrypted: encryptToken(params.accessToken),
      refresh_token_encrypted: params.refreshToken ? encryptToken(params.refreshToken) : null,
      token_expires_at: expiresAt,
      scope: params.scope,
      live_mode: params.liveMode,
      status: 'connected',
      last_error: null,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
    }], { onConflict: 'company_id,provider' })
  if (error) throw new Error(`Erro ao salvar conta de pagamento: ${error.message}`)
}

export async function markAccountDisconnected(companyId: string, provider = 'mercadopago') {
  const { error } = await (supabaseAdmin.from('store_payment_accounts') as any)
    .update({
      status: 'disconnected',
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      disconnected_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('provider', provider)
  if (error) throw new Error(`Erro ao desconectar conta de pagamento: ${error.message}`)
}

export async function markAccountError(companyId: string, provider: string, message: string) {
  await (supabaseAdmin.from('store_payment_accounts') as any)
    .update({ status: 'error', last_error: message })
    .eq('company_id', companyId)
    .eq('provider', provider)
}
