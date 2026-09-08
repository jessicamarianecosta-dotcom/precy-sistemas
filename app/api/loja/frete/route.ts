import { NextResponse } from 'next/server'
import { getShippingAdapter } from '@/lib/catalog/shipping'
import { getShippingOriginSettings, resolveShippingItems } from '@/lib/catalog/shipping/resolveCartShipping'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * POST /api/loja/frete
 * Rota pública (visitante anônimo da loja) — body: { slug, cep, items: [{productId, quantity}] }
 * Resolve a loja pelo slug, usa o endereço de origem cadastrado pela
 * própria empresa (catalog_shipping_settings) e o peso/dimensões reais dos
 * produtos do carrinho — nunca aceita esses dados vindos do client.
 */
export async function POST(request: Request) {
  if (!checkRateLimit(`loja-frete:${getClientIp(request)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  const cep = String(body?.cep ?? '').replace(/\D/g, '')
  const items: { productId: string; quantity: number }[] = Array.isArray(body?.items) ? body.items : []

  if (!slug || !cep || items.length === 0) {
    return NextResponse.json({ error: 'Dados insuficientes para calcular o frete' }, { status: 400 })
  }
  if (cep.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido' }, { status: 400 })
  }

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
  }

  const origin = await getShippingOriginSettings(companyId)
  if (!origin) {
    return NextResponse.json({
      error: 'Esta loja ainda não configurou o endereço de envio. Fale com o vendedor.',
    }, { status: 422 })
  }

  const shippingItems = await resolveShippingItems(
    companyId,
    items.map(i => ({ productId: String(i.productId), quantity: Number(i.quantity) || 0 })),
    origin
  )
  if (shippingItems.length === 0) {
    return NextResponse.json({ error: 'Nenhum item válido para calcular o frete' }, { status: 400 })
  }

  try {
    const adapter = getShippingAdapter()
    const quotes = await adapter.quote(origin.originCep, cep, shippingItems)
    return NextResponse.json({ quotes })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao calcular frete' }, { status: 502 })
  }
}
