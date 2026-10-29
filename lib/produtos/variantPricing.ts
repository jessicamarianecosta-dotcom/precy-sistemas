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

/**
 * Aplica o acréscimo das opções selecionadas sobre um preço já resolvido
 * (resolveVariantPricing) — mantém custo/origem, recalcula preço e lucro.
 * Usado depois de resolveVariantPricing em todo lugar que precisa do preço
 * final com acréscimo: editor de variações, seletor de orçamentos/pedidos,
 * loja pública, checkout e orçamento da loja.
 */
export function applyOptionsAdjustment(resolved: ResolvedPricing, options: (OptionPriceAdjustment | null | undefined)[]): ResolvedPricing {
  const adj = calcOptionsAdjustment(resolved.price, options)
  if (adj.adjustmentAmount === 0) return resolved
  return { ...resolved, price: adj.finalPrice, profit: round2(adj.finalPrice - resolved.cost) }
}

/** Rótulo legível da combinação (ex.: "300 un · Offset 240g"). */
export function buildVariantLabel(optionValues: string[]): string {
  return optionValues.filter(Boolean).join(' · ')
}

/**
 * Acréscimo de preço por opção de variação (product_variation_options
 * .price_adjustment_type/price_adjustment_value — migration 088).
 *   'fixed'   → price_adjustment_value em R$, soma direto ao preço-base.
 *   'percent' → price_adjustment_value em % (ex: 10 = 10%), calculado sobre
 *               o preço-base.
 *   null/undefined → "Nenhum", sem acréscimo (opções antigas, 100% compatíveis).
 */
export interface OptionPriceAdjustment {
  price_adjustment_type?: 'fixed' | 'percent' | null
  price_adjustment_value?: number | null
}

export interface OptionsAdjustmentResult {
  /** Preço-base da combinação, antes de qualquer acréscimo de opção. */
  basePrice: number
  /** Soma dos acréscimos fixos (R$) das opções selecionadas. */
  fixedTotal: number
  /** Soma dos percentuais (%) das opções selecionadas (ex: 10 + 5 = 15). */
  percentTotal: number
  /** Valor em R$ do acréscimo percentual (percentTotal aplicado 1x sobre basePrice). */
  percentAmount: number
  /** fixedTotal + percentAmount — total somado ao preço-base. */
  adjustmentAmount: number
  /** basePrice + adjustmentAmount — preço final da combinação. */
  finalPrice: number
}

/**
 * Soma os acréscimos das opções selecionadas (uma por grupo) sobre o
 * preço-base da combinação, calculado sempre em tempo real (nunca
 * congelado em product_variants.price) — por isso, se o preço-base mudar
 * (ex: markup do produto, ou o preço próprio da combinação), o acréscimo
 * percentual é recalculado automaticamente na próxima leitura.
 *
 * Regra de composição quando há mais de uma opção com acréscimo na mesma
 * combinação (documentada para nunca cobrar duas vezes):
 *   - acréscimos fixos se somam entre si (R$ + R$);
 *   - acréscimos percentuais se somam entre si (10% + 5% = 15%) e são
 *     aplicados UMA ÚNICA VEZ sobre o preço-base — nunca compostos em
 *     cascata (não é basePrice × 1.10 × 1.05).
 */
export function calcOptionsAdjustment(basePrice: number, options: (OptionPriceAdjustment | null | undefined)[]): OptionsAdjustmentResult {
  const base = round2(num(basePrice))
  let fixedTotal = 0
  let percentTotal = 0
  for (const o of options) {
    if (!o || !o.price_adjustment_type) continue
    const value = num(o.price_adjustment_value)
    if (value === 0) continue
    if (o.price_adjustment_type === 'fixed') fixedTotal += value
    else if (o.price_adjustment_type === 'percent') percentTotal += value
  }
  fixedTotal = round2(fixedTotal)
  const percentAmount = round2((base * percentTotal) / 100)
  const adjustmentAmount = round2(fixedTotal + percentAmount)
  const finalPrice = round2(base + adjustmentAmount)
  return { basePrice: base, fixedTotal, percentTotal, percentAmount, adjustmentAmount, finalPrice }
}
