import { supabaseAdmin } from '@/lib/supabase/admin'
import { getShippingAdapter } from './index'
import type { ShippingQuote } from './types'

export interface CartShippingLine {
  productId: string
  quantity: number
}

/**
 * Embalagem padrão usada SOMENTE quando o produto não tem peso/dimensões
 * cadastrados ainda (Produtos › editar › "Peso e dimensões da embalagem").
 * É um valor de sistema para a loja não travar — nunca é apresentado como
 * medida real do produto, e o lojista deve preencher o valor verdadeiro.
 */
const FALLBACK_PACKAGE = { weightKg: 0.3, lengthCm: 20, widthCm: 15, heightCm: 5 }

/**
 * Cota o frete de um carrinho a partir do servidor: busca peso/dimensões
 * REAIS de cada produto no banco (nunca aceita essas medidas vindas do
 * client) e usa o CEP de origem cadastrado pela própria loja em
 * Configurações › Endereço (catalog_settings.zip_code), com fallback para
 * SUPERFRETE_ORIGIN_CEP quando a loja não cadastrou.
 *
 * Usada tanto por /api/loja/frete (cotação exibida ao cliente) quanto por
 * /api/loja/checkout (revalidação do frete escolhido antes de cobrar).
 */
export async function quoteCartShipping(
  companyId: string,
  destinationCep: string,
  lines: CartShippingLine[],
): Promise<ShippingQuote[]> {
  const productIds = [...new Set(lines.map(l => l.productId))]
  if (productIds.length === 0) return []

  const { data: products } = await (supabaseAdmin.from('products') as any)
    .select('id, weight_kg, length_cm, width_cm, height_cm')
    .in('id', productIds)
    .eq('company_id', companyId)

  const byId = new Map((products ?? []).map((p: any) => [p.id, p]))

  const { data: settings } = await (supabaseAdmin.from('catalog_settings') as any)
    .select('zip_code')
    .eq('company_id', companyId)
    .maybeSingle()

  const items = lines.map(line => {
    const p: any = byId.get(line.productId)
    return {
      weightKg: Number(p?.weight_kg) > 0 ? Number(p.weight_kg) : FALLBACK_PACKAGE.weightKg,
      lengthCm: Number(p?.length_cm) > 0 ? Number(p.length_cm) : FALLBACK_PACKAGE.lengthCm,
      widthCm: Number(p?.width_cm) > 0 ? Number(p.width_cm) : FALLBACK_PACKAGE.widthCm,
      heightCm: Number(p?.height_cm) > 0 ? Number(p.height_cm) : FALLBACK_PACKAGE.heightCm,
      quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
    }
  })

  const adapter = getShippingAdapter()
  return adapter.quote(destinationCep, items, settings?.zip_code ?? null)
}
