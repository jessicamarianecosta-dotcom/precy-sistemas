/**
 * Fonte única de verdade para os itens de um orçamento.
 *
 * - Se existirem itens em budget_items → retorna os itens enriquecidos com dados do produto.
 * - Se não existirem itens (orçamento legado com product_id NOT NULL quebrado) →
 *   cria um item sintético usando budget.notes (último recurso) para não exibir
 *   "Nenhum item cadastrado" quando existe um orçamento válido com valor.
 *
 * Utilizado em: PDF, impressão, download e visualização.
 */

export interface EffectiveItem {
  name: string
  description: string
  quantity: number
  unit_price: number
  subtotal: number
}

export function getBudgetItems(
  budget: Record<string, unknown>,
  dbItems: Record<string, unknown>[]
): EffectiveItem[] {
  const b = budget as any

  // Caminho principal: itens reais salvos em budget_items
  const enriched: EffectiveItem[] = dbItems.map((item: any) => ({
    name:        item.name        || item.products?.name        || 'Item',
    description: item.description || item.products?.description || '',
    quantity:    Number(item.quantity)   || 1,
    unit_price:  Number(item.unit_price) || 0,
    subtotal:    Number(item.subtotal)   || 0,
  }))

  if (enriched.length > 0) return enriched

  // Fallback: orçamento legado sem itens salvos mas com valor definido
  const total    = Number(b.total)    || 0
  const subtotal = Number(b.subtotal) || total
  if (total <= 0) return []

  // Usa o campo notes como descrição do serviço/produto (melhor dado disponível)
  const fallbackName = String(b.notes || '').trim() || `Orçamento ${b.budget_number || ''}`.trim()
  return [{
    name:        fallbackName,
    description: '',
    quantity:    1,
    unit_price:  subtotal,
    subtotal:    subtotal,
  }]
}
