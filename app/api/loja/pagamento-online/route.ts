import { NextRequest, NextResponse } from 'next/server'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/loja/pagamento-online?slug=...
 * Rota pública (visitante anônimo da loja) — devolve se a empresa tem uma
 * conexão Mercado Pago ATIVA (mercadopago_connections, status 'connected'),
 * para o checkout decidir se mostra "Finalizar pelo site" (Pix/cartão via
 * Payment Brick) ou só "Finalizar pelo WhatsApp", e a `publicKey` (chave
 * pública da conta MP da própria empresa, segura para o frontend) usada para
 * inicializar o Brick. Nunca expõe nada sensível da conexão (tokens etc.).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  if (!slug) return NextResponse.json({ available: false })

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) return NextResponse.json({ available: false })

  const { data } = await (supabaseAdmin.from('mercadopago_connections') as any)
    .select('id, mp_public_key')
    .eq('company_id', companyId)
    .eq('status', 'connected')
    .maybeSingle()

  return NextResponse.json({ available: !!data, publicKey: data?.mp_public_key ?? null })
}
