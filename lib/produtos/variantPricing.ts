/**
 * Precificação por variação/combinação — mesma fórmula do produto:
 *   custo total = material + mão de obra + custos extras
 *   preço       = custo total × (1 + markup/100)
 *   lucro       = preço − custo
 * Fonte única usada pelo editor de variações, orçamentos e pedidos.
 */

export interface VariantPricingInput {
  material_cost?: number | null
  labor_cost?: number | null
  extra_cost?: number | null
  markup_percentage?: number | null
}

export interface VariantRecord extends VariantPricingInput {
  id: string
  price: number | null
  total_cost: number | null
  stock_quantity?: number | null
}

export interface ProductPricingRecord {
  final_price?: number | null
  total_cost?: number | null
  material_cost?: number | null
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const round2 = (v: number) => Math.round(v * 100) / 100

export function calcVariantPricing(i: VariantPricingInput) {
  const totalCost = round2(num(i.material_cost) + num(i.labor_cost) + num(i.extra_cost))
  const price = round2(totalCost * (1 + num(i.markup_percentage) / 100))
  return { totalCost, price, profit: round2(price - totalCost) }
}

export interface ResolvedPricing {
  price: number
  cost: number
  profit: number
  /** 'variant' = combinação precificada; 'product' = fallback para o produto */
  source: 'variant' | 'product'
}

/**
 * Variação com preço próprio → usa preço/custo da variação.
 * Variação sem preço próprio → fallback para preço/custo do produto
 * (comportamento anterior, nada quebra).
 */
export function resolveVariantPricing(variant: VariantRecord | null, product: ProductPricingRecord): ResolvedPricing {
  const productPrice = num(product.final_price)
  const productCost = num(product.total_cost) || num(product.material_cost)
  if (variant && variant.price != null && num(variant.price) >= 0) {
    const price = num(variant.price)
    const cost = variant.total_cost != null ? num(variant.total_cost) : productCost
    return { price, cost, profit: round2(price - cost), source: 'variant' }
  }
  return { price: productPrice, cost: productCost, profit: round2(productPrice - productCost), source: 'product' }
}

/** Rótulo legível da combinação (ex.: "300 un · Offset 240g"). */
export function buildVariantLabel(optionValues: string[]): string {
  return optionValues.filter(Boolean).join(' · ')
}
