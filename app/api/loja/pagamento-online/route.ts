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
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'connected')
    .maybeSingle()

  return NextResponse.json({ available: !!data })
}
