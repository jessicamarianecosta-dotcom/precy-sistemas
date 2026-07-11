import { NextResponse } from 'next/server'
import { getShippingAdapter, type ShippingItem } from '@/lib/catalog/shipping'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'

/**
 * POST /api/loja/frete
 * Rota pública (visitante anônimo da loja) — body: { slug, cep, items }
 * Resolve a loja pelo slug e devolve as opções de frete (adapter SuperFrete,
 * modo mock enquanto não houver credenciais).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  const cep = String(body?.cep ?? '').replace(/\D/g, '')
  const items: ShippingItem[] = Array.isArray(body?.items) ? body.items : []

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

  try {
    const adapter = getShippingAdapter()
    const quotes = await adapter.quote(cep, items)
    return NextResponse.json({ quotes })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao calcular frete' }, { status: 502 })
  }
}
