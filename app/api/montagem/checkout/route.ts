import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPaymentAdapter } from '@/lib/catalog/payments'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { montagemRef } from '@/lib/montagem/licenseCascade'

export const runtime = 'nodejs'

const PRICE_BRL = 27
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/montagem/checkout
 *
 * Rota pública (visitante sem conta) — cadastro simples (nome/e-mail/
 * telefone) + compra avulsa de acesso anual ao Precy Montagem. Cria a
 * licença como 'pending' e devolve o link de pagamento do Mercado Pago;
 * o acesso só é liberado quando o webhook confirma o pagamento (ver
 * lib/montagem/licenseCascade.ts e app/api/webhooks/mercadopago/route.ts).
 */
export async function POST(request: Request) {
  if (!checkRateLimit(`montagem-checkout:${getClientIp(request)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  let body: { name?: string; email?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const phone = (body.phone ?? '').trim()

  if (!name) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })

  const licenseId = randomUUID()

  const { error: insertError } = await (supabaseAdmin.from('montagem_licenses') as any).insert({
    id: licenseId,
    name,
    email,
    phone: phone || null,
    amount_cents: Math.round(PRICE_BRL * 100),
    status: 'pending',
  })

  if (insertError) {
    console.error('[montagem/checkout] falha ao criar licença:', insertError.message)
    return NextResponse.json({ error: 'Não foi possível iniciar a compra.' }, { status: 500 })
  }

  try {
    const adapter = getPaymentAdapter()
    const charge = await adapter.createCharge({
      ref: montagemRef(licenseId),
      amount: PRICE_BRL,
      customerName: name,
      customerEmail: email,
      customerPhone: phone || null,
      description: 'Precy Montagem — acesso avulso (1 ano)',
      returnPath: `/montagem/retorno?ref=${licenseId}`,
    })

    return NextResponse.json({ redirectUrl: charge.redirectUrl })
  } catch (err: any) {
    console.error('[montagem/checkout] falha ao criar cobrança:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Pagamentos indisponíveis no momento.' }, { status: 500 })
  }
}
