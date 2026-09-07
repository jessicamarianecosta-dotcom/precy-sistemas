import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireCatalogImportAccess } from '@/lib/catalog/importServerAuth'
import { checkUsageLimit } from '@/lib/subscription/check'

interface ConfirmItem {
  action: 'create' | 'update' | 'skip'
  targetProductId?: string
  name: string
  category?: string | null
  price?: number | null
  unit?: string | null
  minQuantity?: number | null
  notes?: string | null
  needsReview?: boolean
}

// Nomes que o parser nunca deve produzir como resultado final, mas que
// bloqueamos de novo aqui — nunca confiar só na tela de revisão ter feito
// essa checagem. Um nome vazio ou um destes placeholders nunca vira produto,
// mesmo que a requisição tenha sido montada/adulterada fora da tela normal.
const BLOCKED_NAMES = new Set(['nao identificado', 'não identificado', 'not identified', 'sem nome', ''])

function isValidProductName(name: unknown): name is string {
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length < 2) return false
  if (BLOCKED_NAMES.has(trimmed.toLowerCase())) return false
  return true
}

/**
 * POST /api/produtos/importar-catalogo/confirmar
 * Body: { filename: string, sourceLabel?: string, items: ConfirmItem[] }
 *
 * Cria/atualiza produtos na MESMA tabela `products` usada pelo módulo
 * Produtos e pelo Catálogo Online — nunca uma tabela paralela. Produto
 * importado nasce is_published_catalog=false (mesma regra do import da
 * Biblioteca Precy+ em app/api/catalogo/biblioteca/importar): quem decide o
 * que publicar é a pessoa, depois, no próprio módulo Produtos.
 *
 * Exclusivo da conta autorizada, checado de novo aqui (nunca confiar só na
 * tela de revisão já ter passado por isso) — ver lib/catalog/importServerAuth.ts.
 */
export async function POST(request: Request) {
  const auth = await requireCatalogImportAccess()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const filename = typeof body?.filename === 'string' ? body.filename : null
  const sourceLabel = typeof body?.sourceLabel === 'string' ? body.sourceLabel : 'PDF'
  const items: ConfirmItem[] = Array.isArray(body?.items) ? body.items : []

  if (items.length === 0) {
    return NextResponse.json({ error: 'Nenhum item para importar' }, { status: 400 })
  }

  const errors: string[] = []

  // Bloqueio de nome inválido/placeholder vale ANTES de separar create/update
  // — um item assim nunca cria nem atualiza produto, mesmo que tenha vindo
  // marcado como selecionado.
  const invalidNamed = items.filter(i => i.action !== 'skip' && !isValidProductName(i.name))
  for (const item of invalidNamed) {
    errors.push(`Item sem nome identificado foi ignorado (não pode ser importado sem revisão manual).`)
  }
  const actionable = items.filter(i => i.action === 'skip' || isValidProductName(i.name))

  const toCreate = actionable.filter(i => i.action === 'create')
  const toUpdate = actionable.filter(i => i.action === 'update')
  const skippedCount = items.filter(i => i.action === 'skip').length + invalidNamed.length

  // Mesma checagem de limite de plano do fluxo manual/da Biblioteca Precy+.
  if (toCreate.length > 0) {
    const usage = await checkUsageLimit(auth.companyId, 'products', auth.plan.plan)
    if (Number.isFinite(usage.limit) && usage.current + toCreate.length > usage.limit) {
      return NextResponse.json({
        error: `Importar ${toCreate.length} produtos novos ultrapassaria o limite de ${usage.limit} do plano. Você tem ${usage.current} produto(s) e pode criar até ${Math.max(0, usage.limit - usage.current)}.`,
      }, { status: 403 })
    }
  }

  let importedCount = 0
  let updatedCount = 0

  if (toCreate.length > 0) {
    const rows = toCreate.map(item => ({
      company_id: auth.companyId,
      name: item.name,
      category: item.category || 'Importado',
      unit: item.unit || 'un',
      final_price: item.price ?? 0,
      material_cost: 0,
      production_time_hours: 0,
      markup_percentage: 0,
      is_active: true,
      is_published_catalog: false,
      technical_notes: buildImportNote(sourceLabel, filename, item),
    }))
    const { data: inserted, error } = await (supabaseAdmin.from('products') as any)
      .insert(rows)
      .select('id')
    if (error) {
      errors.push(`Erro ao criar produtos: ${error.message}`)
    } else {
      importedCount = inserted?.length ?? 0
    }
  }

  for (const item of toUpdate) {
    if (!item.targetProductId) { errors.push(`Item "${item.name}" sem produto de destino para atualizar.`); continue }

    // Nunca confiar no id vindo do client sem checar que o produto é
    // realmente desta empresa — update com .eq('company_id', ...) além do
    // id garante isso mesmo que o id tenha sido adulterado na requisição.
    const patch: Record<string, unknown> = { name: item.name, updated_at: new Date().toISOString() }
    if (item.category) patch.category = item.category
    if (item.price != null) patch.final_price = item.price
    if (item.unit) patch.unit = item.unit

    const { data, error } = await (supabaseAdmin.from('products') as any)
      .update(patch)
      .eq('id', item.targetProductId)
      .eq('company_id', auth.companyId)
      .select('id')

    if (error) errors.push(`Erro ao atualizar "${item.name}": ${error.message}`)
    else if (!data || data.length === 0) errors.push(`Produto "${item.name}" não encontrado para atualizar.`)
    else updatedCount++
  }

  const reviewNeededCount = items.filter(i => i.action !== 'skip' && i.needsReview).length

  await (supabaseAdmin.from('product_import_logs') as any).insert({
    company_id: auth.companyId,
    user_id: auth.userId,
    source_label: sourceLabel,
    source_filename: filename,
    total_found: items.length,
    imported_count: importedCount,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    review_needed_count: reviewNeededCount,
    errors,
  })

  return NextResponse.json({ imported: importedCount, updated: updatedCount, skipped: skippedCount, errors })
}

function buildImportNote(sourceLabel: string, filename: string | null, item: ConfirmItem): string {
  const parts = [`Importado de ${sourceLabel}${filename ? ` (${filename})` : ''} em ${new Date().toLocaleDateString('pt-BR')}.`]
  if (item.minQuantity) parts.push(`Quantidade mínima informada na fonte: ${item.minQuantity}.`)
  if (item.notes) parts.push(item.notes)
  return parts.join(' ')
}
