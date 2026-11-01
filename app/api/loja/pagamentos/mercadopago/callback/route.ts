import { NextRequest, NextResponse } from 'next/server'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function redirectUri(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  return `${appUrl}/api/loja/pagamentos/mercadopago/callback`
}

function backToSettings(ok: boolean, message?: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const url = new URL(`${appUrl}/catalogo`)
  url.searchParams.set('aba', 'pagamentos')
  url.searchParams.set('mp_connect', ok ? 'success' : 'error')
  if (message) url.searchParams.set('mp_message', message)
  return NextResponse.redirect(url)
}

/**
 * GET /api/loja/pagamentos/mercadopago/callback?code=...&state=...
 *
 * Rota pública (o navegador do lojista é redirecionado aqui pelo Mercado
 * Pago, sem sessão do Precy no cabeçalho) — a identidade da loja vem do
 * `state` emitido em /connect, nunca de um company_id na URL.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  if (errorParam) {
    return backToSettings(false, 'Conexão cancelada pelo usuário')
  }
  if (!code || !state) {
    return backToSettings(false, 'Resposta inválida do Mercado Pago')
  }

  const { data: pending, error: findError } = await (supabaseAdmin.from('store_payment_accounts') as any)
    .select('company_id')
    .eq('provider', 'mercadopago')
    .eq('scope', `pending_state:${state}`)
    .maybeSingle()

  if (findError || !pending) {
    return backToSettings(false, 'Sessão de conexão expirada — tente conectar novamente')
  }

  try {
    await getPaymentGateway().handleOAuthCallback(pending.company_id, code, redirectUri())
  } catch (err: any) {
    console.error('[mercadopago/callback] falha ao concluir conexão:', err?.message ?? err)
    return backToSettings(false, err?.message ?? 'Erro ao concluir conexão')
  }

  return backToSettings(true)
}
