import { NextRequest, NextResponse } from 'next/server'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/loja/pagamento-online?slug=...
 * Rota pública (visitante anônimo da loja) — devolve só um booleano dizendo
 * se a empresa tem uma conexão Mercado Pago ATIVA (mercadopago_connections,
 * status 'connected'), para o checkout decidir se mostra "Finalizar pelo
 * site" ou só "Finalizar pelo WhatsApp". Nunca expõe nada da conexão em si
 * (tokens, nickname etc.) — só o booleano.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  if (!slug) return NextResponse.json({ available: false })

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) return NextResponse.json({ available: false })

  const { data } = await (supabaseAdmin.from('mercadopago_connections') as any)
    .select('mp_public_key, pix_enabled, card_enabled, installments_default')
    .eq('company_id', companyId)
    .eq('status', 'connected')
    .maybeSingle()

  const pixEnabled = data?.pix_enabled !== false
  const cardEnabled = data?.card_enabled !== false
  if (!data?.mp_public_key || (!pixEnabled && !cardEnabled)) return NextResponse.json({ available: false })

  return NextResponse.json({
    available: true,
    // mp_public_key é seguro no client: é a chave feita para isso (nunca o
    // access_token), usada só para o Payment Brick tokenizar o cartão.
    publicKey: data.mp_public_key,
    pixEnabled,
    cardEnabled,
    maxInstallments: data.installments_default || 12,
  })
}
