import { NextResponse } from 'next/server'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { quoteCartShipping, type CartShippingLine } from '@/lib/catalog/shipping/quoteCart'

/**
 * POST /api/loja/frete
 * Rota pública (visitante anônimo da loja) — body: { slug, cep, items }
 * items = [{ productId, quantity }] — peso/dimensões NUNCA vêm do client:
 * são sempre lidos do cadastro do produto (quoteCartShipping), para o
 * cliente não conseguir manipular o valor do frete informando uma
 * embalagem menor/mais leve do que a real.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  const cep = String(body?.cep ?? '').replace(/\D/g, '')
  const items: CartShippingLine[] = Array.isArray(body?.items) ? body.items : []

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
    const quotes = await quoteCartShipping(companyId, cep, items)
    return NextResponse.json({ quotes })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao calcular frete' }, { status: 502 })
  }
}
