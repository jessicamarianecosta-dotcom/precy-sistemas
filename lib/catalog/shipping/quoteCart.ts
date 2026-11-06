import { supabaseAdmin } from '@/lib/supabase/admin'
import { getShippingAdapter } from './index'
import type { ShippingQuote } from './types'

export interface CartShippingLine {
  productId: string
  quantity: number
}

/**
 * Erro específico para "não dá para cotar frete real porque falta
 * peso/dimensões no cadastro do produto" — o chamador pode distinguir isso
 * de uma falha genérica da SuperFrete e orientar a loja a completar o
 * cadastro em vez de ver um erro confuso.
 */
export class MissingProductDimensionsError extends Error {
  constructor(public readonly productNames: string[]) {
    super(
      `Não é possível calcular o frete: complete o peso e as dimensões de embalagem no cadastro ` +
      `${productNames.length > 1 ? 'dos produtos' : 'do produto'} "${productNames.join('", "')}" antes de vender com entrega por transportadora.`
    )
    this.name = 'MissingProductDimensionsError'
  }
}

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
    .select('id, name, weight_kg, length_cm, width_cm, height_cm')
    .in('id', productIds)
    .eq('company_id', companyId)

  const byId = new Map((products ?? []).map((p: any) => [p.id, p]))

  const { data: settings } = await (supabaseAdmin.from('catalog_settings') as any)
    .select('zip_code')
    .eq('company_id', companyId)
    .maybeSingle()

  // Nunca inventa peso/dimensões: produto sem cadastro completo bloqueia o
  // cálculo com um erro claro, em vez de cotar frete com uma embalagem
  // fictícia (o cliente pagaria/receberia um frete que não corresponde à
  // encomenda real).
  const missingNames = (products ?? [])
    .filter((p: any) => !(Number(p.weight_kg) > 0 && Number(p.length_cm) > 0 && Number(p.width_cm) > 0 && Number(p.height_cm) > 0))
    .map((p: any) => p.name as string)
  if (missingNames.length > 0) {
    throw new MissingProductDimensionsError(missingNames)
  }

  const items = lines.map(line => {
    const p: any = byId.get(line.productId)
    return {
      weightKg: Number(p.weight_kg),
      lengthCm: Number(p.length_cm),
      widthCm: Number(p.width_cm),
      heightCm: Number(p.height_cm),
      quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
    }
  })

  const adapter = getShippingAdapter()
  return adapter.quote(destinationCep, items, settings?.zip_code ?? null)
}
