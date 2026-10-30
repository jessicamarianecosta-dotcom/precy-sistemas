import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { parseVariantsWorkbook } from '@/lib/catalog/variantsExcel'
import { calcOptionsAdjustment } from '@/lib/produtos/variantPricing'
import type { GroupRow } from '@/lib/catalog/variationCombos'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export interface ImportPreviewUpdate {
  id: string
  label: string
  currentBase: number
  newBase: number
  currentFinal: number
  finalPrice: number
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
    // (nome das opções, acréscimos etc.) — só o ID e o novo preço-base são lidos do arquivo.
    const { data: variantRows } = await db
      .from('product_variants')
      .select('id, price, product_variant_option_values(option_id, group_id)')
      .eq('product_id', productId)
      .eq('company_id', companyId)

    const variantById = new Map<string, { price: number | null; optionIdsByGroup: (string | undefined)[]; label: string }>()
    for (const v of (variantRows ?? []) as any[]) {
      const byGroup = new Map<string, string>((v.product_variant_option_values ?? []).map((ov: any) => [ov.group_id, ov.option_id]))
      const optionIdsByGroup = groups.map(g => byGroup.get(g.id))
      const label = groups
        .map((g, idx) => g.options.find(o => o.id === optionIdsByGroup[idx])?.value)
        .filter(Boolean)
        .join(' · ') || '—'
      variantById.set(v.id, { price: v.price != null ? Number(v.price) : null, optionIdsByGroup, label })
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

      if (!r.hasNewPrice) { unchangedCount++; continue }

      const currentBase = variant.price ?? productPrice
      const options = groups.map((g, idx) => g.options.find(o => o.id === variant.optionIdsByGroup[idx]))
      const currentFinal = calcOptionsAdjustment(currentBase, options).finalPrice
      const finalPrice = calcOptionsAdjustment(r.newPrice as number, options).finalPrice

      updates.push({ id: r.id, label: variant.label, currentBase, newBase: r.newPrice as number, currentFinal, finalPrice })
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
