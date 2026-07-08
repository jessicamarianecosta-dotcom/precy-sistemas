/**
 * Fonte única de verdade para os itens de um pedido.
 *
 * - Se existirem itens em order_items → retorna os itens enriquecidos com dados do produto.
 * - Se não existirem itens (pedido legado de produto único, anterior ao carrinho) →
 *   cria um item sintético usando order.service_name/description/total para não exibir
 *   "Nenhum item cadastrado" quando existe um pedido válido com valor.
 *
 * Utilizado em: PDF, impressão, download e visualização.
 */

export interface EffectiveOrderItem {
  name: string
  description: string
  quantity: number
  unit_price: number
  subtotal: number
  // Especificações técnicas (opcionais)
  width?: number
  height?: number
  area?: number
  measurement_unit?: string
  finishings?: string[]
  finishing_type?: string
  technical_notes?: string
}

export function getOrderItems(
  order: Record<string, unknown>,
  dbItems: Record<string, unknown>[]
): EffectiveOrderItem[] {
  const o = order as any

  // Caminho principal: itens reais salvos em order_items
  const enriched: EffectiveOrderItem[] = dbItems.map((item: any) => ({
    name:             item.name             || item.products?.name        || 'Item',
    description:      item.description      || item.products?.description || '',
    quantity:         Number(item.quantity)   || 1,
    unit_price:       Number(item.unit_price) || 0,
    subtotal:         Number(item.subtotal)   || 0,
    width:            item.width             ?? item.products?.width         ?? undefined,
    height:           item.height            ?? item.products?.height        ?? undefined,
    area:             item.area              ?? item.products?.area          ?? undefined,
    measurement_unit: item.measurement_unit  ?? item.products?.measurement_unit ?? undefined,
    finishings:       Array.isArray(item.finishings)          ? item.finishings
                    : Array.isArray(item.products?.finishings) ? item.products.finishings
                    : undefined,
    finishing_type:   item.finishing_type   ?? item.products?.finishing_type   ?? undefined,
    technical_notes:  item.technical_notes  ?? item.products?.technical_notes  ?? undefined,
  }))

  if (enriched.length > 0) return enriched

  // Fallback: pedido legado (anterior ao carrinho) sem itens salvos mas com valor definido
  const total    = Number(o.total)    || 0
  const subtotal = Number(o.subtotal) || total
  if (total <= 0 && subtotal <= 0) return []

  const fallbackName = String(o.service_name || '').trim() || `Pedido ${o.order_number || ''}`.trim()
  return [{
    name:        fallbackName,
    description: String(o.description || ''),
    quantity:    1,
    unit_price:  subtotal,
    subtotal:    subtotal,
  }]
}
