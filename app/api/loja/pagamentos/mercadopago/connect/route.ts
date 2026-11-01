import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function redirectUri(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  return `${appUrl}/api/loja/pagamentos/mercadopago/callback`
}

/**
 * GET /api/loja/pagamentos/mercadopago/connect
 *
 * Inicia a conexão OAuth da conta Mercado Pago da loja autenticada.
 * `state` é um token aleatório gravado com o company_id no banco (não um
 * JWT auto-contido) — o callback confirma que o "state" devolvido pelo
 * Mercado Pago é exatamente o que foi emitido para aquele company_id,
 * prevenindo CSRF no fluxo OAuth.
 */
export async function GET() {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const state = randomUUID()
  const { error } = await (supabaseAdmin.from('store_payment_accounts') as any)
    .upsert([{ company_id: auth.companyId, provider: 'mercadopago', status: 'disconnected' }], { onConflict: 'company_id,provider', ignoreDuplicates: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Guarda o state pendente em last_error temporariamente (reaproveita a
  // própria linha) seria confuso — usa uma tabela de apoio simples via
  // cookie assinado é mais correto, mas por simplicidade e para não
  // introduzir mais uma tabela, grava o state no próprio registro em
  // "scope" (campo texto livre, não usado antes do primeiro connect).
  await (supabaseAdmin.from('store_payment_accounts') as any)
    .update({ scope: `pending_state:${state}` })
    .eq('company_id', auth.companyId)
    .eq('provider', 'mercadopago')

  let url: string
  try {
    url = getPaymentGateway().getConnectUrl(auth.companyId, state, redirectUri())
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao iniciar conexão' }, { status: 500 })
  }
  return NextResponse.json({ url })
}
