/*
 * Ações de produto compartilhadas entre Produtos e Catálogo Online → Produtos.
 * Uma única implementação de duplicar e excluir, para as duas telas se
 * comportarem igual.
 */

// `supabase` é o client do navegador (lib/supabase/client); o resto do app já
// o usa sem tipos nas tabelas, então aqui também.
type Db = any

/**
 * Cria uma cópia do produto com NOVO id, sempre NÃO publicada no catálogo
 * (mesmo que o original esteja publicada) e com o nome "<nome> (cópia)".
 * Copia materiais, fotos do catálogo, variações, dependências e variantes.
 * O produto original nunca é alterado.
 */
export async function duplicateProduct(
  supabase: Db,
  companyId: string,
  sourceId: string
): Promise<{ id: string; name: string }> {
  const { data: source, error: srcErr } = await supabase
    .from('products').select('*').eq('id', sourceId).eq('company_id', companyId).single()
  if (srcErr || !source) throw new Error(srcErr?.message ?? 'Produto não encontrado')

  const { id: _id, created_at: _c, updated_at: _u, ...rest } = source
  const name = `${source.name} (cópia)`

  const { data: newProd, error } = await supabase
    .from('products')
    .insert({ ...rest, company_id: companyId, name, is_active: true, is_published_catalog: false })
    .select('id, name')
    .single()
  if (error || !newProd) throw new Error(error?.message ?? 'Não foi possível criar a cópia')

  // Materiais (ficha técnica)
  const { data: materials } = await supabase.from('product_materials').select('*').eq('product_id', sourceId)
  if (materials && materials.length > 0) {
    const rows = materials.map(({ id: _mid, created_at: _mc, updated_at: _mu, ...m }: any) => ({
      ...m, company_id: companyId, product_id: newProd.id,
    }))
    await supabase.from('product_materials').insert(rows)
  }

  // Fotos do catálogo
  const { data: images } = await supabase
    .from('product_images').select('url, sort_order').eq('product_id', sourceId).order('sort_order')
  if (images && images.length > 0) {
    await supabase.from('product_images').insert(
      images.map((img: { url: string; sort_order: number }) => ({ ...img, company_id: companyId, product_id: newProd.id }))
    )
  }

  // Grupos/opções/variantes de variação
  const { data: groups } = await supabase
    .from('product_variation_groups').select('id, name, sort_order').eq('product_id', sourceId).order('sort_order')
  if (groups && groups.length > 0) {
    const groupIdMap = new Map<string, string>()
    for (const g of groups as { id: string; name: string; sort_order: number }[]) {
      const { data: newGroup } = await supabase
        .from('product_variation_groups')
        .insert({ product_id: newProd.id, company_id: companyId, name: g.name, sort_order: g.sort_order })
        .select('id').single()
      if (newGroup) groupIdMap.set(g.id, newGroup.id)
    }

    const { data: options } = await supabase
      .from('product_variation_options').select('id, group_id, value, sort_order')
      .in('group_id', groups.map((g: { id: string }) => g.id))
    const optionIdMap = new Map<string, string>()
    for (const o of (options ?? []) as { id: string; group_id: string; value: string; sort_order: number }[]) {
      const { data: newOption } = await supabase
        .from('product_variation_options')
        .insert({ group_id: groupIdMap.get(o.group_id), company_id: companyId, value: o.value, sort_order: o.sort_order })
        .select('id').single()
      if (newOption) optionIdMap.set(o.id, newOption.id)
    }

    // Regras de dependência entre opções (ex.: "Triplex/Offset" só em 300g)
    const { data: deps } = await supabase
      .from('product_variation_dependencies').select('option_id, depends_on_option_id').eq('product_id', sourceId)
    if (deps && deps.length > 0) {
      const depRows = (deps as { option_id: string; depends_on_option_id: string }[])
        .map(d => ({
          product_id: newProd.id, company_id: companyId,
          option_id: optionIdMap.get(d.option_id),
          depends_on_option_id: optionIdMap.get(d.depends_on_option_id),
        }))
        .filter(r => !!r.option_id && !!r.depends_on_option_id)
      if (depRows.length > 0) await supabase.from('product_variation_dependencies').insert(depRows)
    }

    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, sku, price, stock_quantity, lead_time_days, weight_kg, sort_order, material_cost, labor_cost, extra_cost, total_cost, markup_percentage, pricing_data, product_variant_option_values(option_id, group_id)')
      .eq('product_id', sourceId)
    for (const v of (variants ?? []) as any[]) {
      const { data: newVariant } = await supabase
        .from('product_variants')
        .insert({
          product_id: newProd.id, company_id: companyId, sku: v.sku, price: v.price,
          stock_quantity: v.stock_quantity, lead_time_days: v.lead_time_days, weight_kg: v.weight_kg,
          sort_order: v.sort_order,
          // precificação própria da combinação acompanha a duplicação
          material_cost: v.material_cost, labor_cost: v.labor_cost, extra_cost: v.extra_cost,
          total_cost: v.total_cost, markup_percentage: v.markup_percentage, pricing_data: v.pricing_data,
        })
        .select('id').single()
      if (!newVariant) continue
      const valueRows = (v.product_variant_option_values ?? [])
        .map((ov: { option_id: string; group_id: string }) => ({
          variant_id: newVariant.id,
          option_id: optionIdMap.get(ov.option_id),
          group_id: groupIdMap.get(ov.group_id),
        }))
        .filter((r: { option_id?: string; group_id?: string }) => r.option_id && r.group_id)
      if (valueRows.length > 0) await supabase.from('product_variant_option_values').insert(valueRows)
    }
  }

  return { id: newProd.id, name: newProd.name }
}

export interface DeleteProductResult {
  /** 'deleted' = removido de vez (sem histórico); 'archived' = inativado, histórico preservado. */
  mode: 'deleted' | 'archived'
  /** Resumo do que referencia o produto (ex.: "3 pedidos e 2 orçamentos"), quando arquivado. */
  linkedTo?: string
}

async function countRefs(supabase: Db, table: string, column: string, productId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table).select('id', { count: 'exact', head: true }).eq(column, productId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Exclui SOMENTE o produto informado.
 *  - Sem pedidos/orçamentos/declarações ligados: exclusão definitiva (materiais,
 *    fotos e variações saem junto pelo ON DELETE CASCADE do banco).
 *  - Com histórico: exclusão lógica — is_active=false e despublica do catálogo.
 *    Os itens de pedidos e orçamentos continuam apontando para o produto, então
 *    nenhum histórico muda. Pedidos, orçamentos e a lista de Produtos já filtram
 *    por is_active, então o produto some de todos os seletores e listas.
 */
export async function deleteProduct(supabase: Db, companyId: string, productId: string): Promise<DeleteProductResult> {
  const [orderItems, budgetItems, orders, declarations] = await Promise.all([
    countRefs(supabase, 'order_items', 'product_id', productId),
    countRefs(supabase, 'budget_items', 'product_id', productId),
    countRefs(supabase, 'orders', 'product_id', productId),
    countRefs(supabase, 'content_declaration_items', 'product_id', productId),
  ])

  if (orderItems + budgetItems + orders + declarations > 0) {
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: false, is_published_catalog: false })
      .eq('id', productId).eq('company_id', companyId)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) throw new Error('Nenhum produto foi atualizado — verifique se ele ainda existe ou se você tem permissão.')

    const parts: string[] = []
    const pedidos = Math.max(orderItems, orders)
    if (pedidos > 0) parts.push(`${pedidos} item${pedidos === 1 ? '' : 's'} de pedido`)
    if (budgetItems > 0) parts.push(`${budgetItems} item${budgetItems === 1 ? '' : 's'} de orçamento`)
    if (declarations > 0) parts.push(`${declarations} declaração${declarations === 1 ? '' : 'ões'} de conteúdo`)
    return { mode: 'archived', linkedTo: parts.join(' e ') }
  }

  const { data, error } = await supabase
    .from('products').delete().eq('id', productId).eq('company_id', companyId).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Nenhum produto foi excluído — verifique se ele ainda existe ou se você tem permissão.')
  return { mode: 'deleted' }
}
