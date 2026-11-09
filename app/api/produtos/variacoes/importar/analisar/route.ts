import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { parseVariantsWorkbook } from '@/lib/catalog/variantsExcel'
import { calcOptionsAdjustment } from '@/lib/produtos/variantPricing'
import type { GroupRow } from '@/lib/catalog/variationCombos'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export interface ImportFieldChange {
  field: 'price' | 'status' | 'sku' | 'stock_quantity' | 'lead_time_days' | 'weight_kg'
  label: string
  current: string
  next: string
}
export interface ImportPreviewUpdate {
  id: string
  label: string
  changes: ImportFieldChange[]
  /** Preenchido só quando o preço muda — preço final já recalculado com os acréscimos da combinação. */
  currentFinal?: number
  finalPrice?: number
}
export interface ImportPreviewInvalidRow {
  row: number
  id: string
  reason: string
}

/**
 * POST /api/produtos/variacoes/importar/analisar
 * Body: multipart/form-data { file, productId }
 * Lê a planilha, cruza com as combinações atuais do produto e devolve uma
 * prévia (quantas serão atualizadas, quais ficam inválidas e por quê).
 * NÃO grava nada — confirmação é um passo separado (.../confirmar).
 */
export async function POST(request: Request) {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const companyId = await resolveCompanyIdForUser(user.id)
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const productId = String(formData.get('productId') ?? '')

    if (!productId) return NextResponse.json({ error: 'productId é obrigatório.' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Arquivo muito grande (máximo 10MB).' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Envie um arquivo .xlsx (Excel). Outros formatos não são aceitos.' }, { status: 400 })
    }

    const db = supabaseAdmin as any
    const { data: product, error: prodErr } = await db
      .from('products')
      .select('id, name, final_price')
      .eq('id', productId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (prodErr) throw prodErr
    if (!product) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })

    const arrayBuffer = await file.arrayBuffer()
    const parsed = await parseVariantsWorkbook(arrayBuffer)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 })
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha com dados foi encontrada nesta planilha.' }, { status: 422 })
    }

    const { data: groupRows } = await db
      .from('product_variation_groups')
      .select('id, name, sort_order, product_variation_options(id, group_id, value, sort_order, price_adjustment_type, price_adjustment_value)')
      .eq('product_id', productId)
      .order('sort_order')
      .order('sort_order', { foreignTable: 'product_variation_options' })
    const groups: GroupRow[] = (groupRows ?? []).map((g: any) => ({
      id: g.id, name: g.name, sort_order: g.sort_order, options: g.product_variation_options ?? [],
    }))

    // Sempre a partir do banco, nunca confiando nas colunas informativas da planilha
    // (nome das opções, acréscimos etc.) — só o ID e os campos editáveis são lidos do arquivo.
    const { data: variantRows } = await db
      .from('product_variants')
      .select('id, price, sku, stock_quantity, lead_time_days, weight_kg, is_active, product_variant_option_values(option_id, group_id)')
      .eq('product_id', productId)
      .eq('company_id', companyId)

    interface VariantInfo {
      price: number | null; sku: string | null; stock_quantity: number | null
      lead_time_days: number | null; weight_kg: number | null; is_active: boolean
      optionIdsByGroup: (string | undefined)[]; label: string
    }
    const variantById = new Map<string, VariantInfo>()
    for (const v of (variantRows ?? []) as any[]) {
      const byGroup = new Map<string, string>((v.product_variant_option_values ?? []).map((ov: any) => [ov.group_id, ov.option_id]))
      const optionIdsByGroup = groups.map(g => byGroup.get(g.id))
      const label = groups
        .map((g, idx) => g.options.find(o => o.id === optionIdsByGroup[idx])?.value)
        .filter(Boolean)
        .join(' · ') || '—'
      variantById.set(v.id, {
        price: v.price != null ? Number(v.price) : null, sku: v.sku, stock_quantity: v.stock_quantity,
        lead_time_days: v.lead_time_days, weight_kg: v.weight_kg != null ? Number(v.weight_kg) : null,
        is_active: v.is_active, optionIdsByGroup, label,
      })
    }

    const productPrice = Number(product.final_price ?? 0)
    const seenIds = new Set<string>()
    const invalidRows: ImportPreviewInvalidRow[] = []
    const updates: ImportPreviewUpdate[] = []
    let unchangedCount = 0

    for (const r of parsed.rows) {
      if (r.error) { invalidRows.push({ row: r.rowNumber, id: r.id, reason: r.error }); continue }
      const variant = variantById.get(r.id)
      if (!variant) {
        invalidRows.push({ row: r.rowNumber, id: r.id, reason: 'Combinação não encontrada neste produto (ID inválido, de outro produto, ou excluída).' })
        continue
      }
      if (seenIds.has(r.id)) {
        invalidRows.push({ row: r.rowNumber, id: r.id, reason: 'ID de combinação duplicado nesta planilha.' })
        continue
      }
      seenIds.add(r.id)

      const changes: ImportFieldChange[] = []
      let currentFinal: number | undefined
      let finalPrice: number | undefined

      if (r.hasNewPrice && r.newPrice !== variant.price) {
        const currentBase = variant.price ?? productPrice
        const options = groups.map((g, idx) => g.options.find(o => o.id === variant.optionIdsByGroup[idx]))
        currentFinal = calcOptionsAdjustment(currentBase, options).finalPrice
        finalPrice = calcOptionsAdjustment(r.newPrice as number, options).finalPrice
        changes.push({ field: 'price', label: 'Preço-base', current: currentBase.toFixed(2), next: (r.newPrice as number).toFixed(2) })
      }
      if (r.hasStatus && r.status !== variant.is_active) {
        changes.push({ field: 'status', label: 'Status', current: variant.is_active ? 'Ativa' : 'Inativa', next: r.status ? 'Ativa' : 'Inativa' })
      }
      if (r.hasSku && r.sku !== variant.sku) {
        changes.push({ field: 'sku', label: 'SKU', current: variant.sku ?? '—', next: r.sku ?? '—' })
      }
      if (r.hasStock && r.stock !== variant.stock_quantity) {
        changes.push({ field: 'stock_quantity', label: 'Estoque', current: variant.stock_quantity?.toString() ?? '—', next: r.stock?.toString() ?? '—' })
      }
      if (r.hasLeadTime && r.leadTime !== variant.lead_time_days) {
        changes.push({ field: 'lead_time_days', label: 'Prazo (dias)', current: variant.lead_time_days?.toString() ?? '—', next: r.leadTime?.toString() ?? '—' })
      }
      if (r.hasWeight && r.weight !== variant.weight_kg) {
        changes.push({ field: 'weight_kg', label: 'Peso (kg)', current: variant.weight_kg?.toString() ?? '—', next: r.weight?.toString() ?? '—' })
      }

      if (changes.length === 0) { unchangedCount++; continue }
      updates.push({ id: r.id, label: variant.label, changes, currentFinal, finalPrice })
    }

    return NextResponse.json({
      productId,
      productName: product.name,
      totalFound: parsed.rows.length,
      toUpdateCount: updates.length,
      unchangedCount,
      invalidCount: invalidRows.length,
      updates,
      invalidRows,
    })
  } catch (err: any) {
    console.error('[produtos/variacoes/importar/analisar] erro:', err)
    return NextResponse.json({ error: 'Erro ao ler a planilha. Verifique o arquivo e tente novamente.' }, { status: 500 })
  }
}
