import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { parseCreateVariantsWorkbook } from '@/lib/catalog/variantsExcel'
import { comboKey, type GroupRow } from '@/lib/catalog/variationCombos'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export interface CreateBulkPreviewRow {
  rowNumber: number
  label: string
  price: number
  sku: string | null
  stock: number | null
  leadTime: number | null
  weight: number | null
  /** Enviado como está para .../confirmar — não recalculado no client. */
  options: { group_id: string; option_id: string }[]
}
export interface CreateBulkInvalidRow { row: number; reason: string }

/**
 * POST /api/produtos/variacoes/criar-em-massa/analisar
 * Body: multipart/form-data { file, productId }
 * Lê o modelo de criação em massa, resolve cada valor de texto digitado
 * (dropdown) contra os grupos/opções ATUAIS do produto, identifica
 * combinações já existentes (nunca duplica) e devolve uma prévia. NÃO grava
 * nada — confirmação é um passo separado (.../confirmar).
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
      .from('products').select('id, name').eq('id', productId).eq('company_id', companyId).maybeSingle()
    if (prodErr) throw prodErr
    if (!product) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })

    const { data: groupRows } = await db
      .from('product_variation_groups')
      .select('id, name, sort_order, is_required, product_variation_options(id, group_id, value, sort_order)')
      .eq('product_id', productId)
      .order('sort_order')
      .order('sort_order', { foreignTable: 'product_variation_options' })
    const groups: GroupRow[] = (groupRows ?? []).map((g: any) => ({
      id: g.id, name: g.name, sort_order: g.sort_order, is_required: g.is_required ?? true,
      options: g.product_variation_options ?? [],
    }))
    if (groups.length === 0) {
      return NextResponse.json({ error: 'Este produto não tem grupos de variação cadastrados.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const parsed = await parseCreateVariantsWorkbook(arrayBuffer, groups.map(g => ({ id: g.id, name: g.name })))
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 })
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha preenchida foi encontrada nesta planilha.' }, { status: 422 })
    }

    // Combinações já existentes — nunca duplica (mesmo conjunto de
    // option_ids, na mesma ordem dos grupos, igual ao resto do sistema).
    const { data: existingVariants } = await db
      .from('product_variants')
      .select('id, product_variant_option_values(option_id, group_id)')
      .eq('product_id', productId)
    const existingKeys = new Set<string>((existingVariants ?? []).map((v: any) => {
      const byGroup = new Map<string, string>((v.product_variant_option_values ?? []).map((ov: any) => [ov.group_id, ov.option_id]))
      return comboKey(groups.map(g => byGroup.get(g.id)))
    }))

    const invalidRows: CreateBulkInvalidRow[] = []
    const duplicateRows: { row: number; label: string }[] = []
    const toCreate: CreateBulkPreviewRow[] = []
    const seenInFile = new Set<string>()

    for (const r of parsed.rows) {
      if (r.error) { invalidRows.push({ row: r.rowNumber, reason: r.error }); continue }

      const options: { group_id: string; option_id: string }[] = []
      const labelParts: string[] = []
      let rowError: string | null = null
      groups.forEach((g, idx) => {
        const raw = r.valueByGroup[idx] ?? ''
        if (raw === '') {
          if (g.is_required !== false) rowError = rowError ?? `Grupo "${g.name}" é obrigatório — escolha uma opção da lista.`
          return
        }
        const opt = g.options.find(o => o.value.trim().toLowerCase() === raw.toLowerCase())
        if (!opt) { rowError = rowError ?? `Valor "${raw}" não é uma opção válida do grupo "${g.name}".`; return }
        options.push({ group_id: g.id, option_id: opt.id })
        labelParts.push(`${g.name}: ${opt.value}`)
      })
      if (rowError) { invalidRows.push({ row: r.rowNumber, reason: rowError }); continue }
      if (r.price == null) { invalidRows.push({ row: r.rowNumber, reason: 'Preço-base é obrigatório.' }); continue }

      const key = comboKey(groups.map(g => options.find(o => o.group_id === g.id)?.option_id))
      if (existingKeys.has(key)) {
        duplicateRows.push({ row: r.rowNumber, label: labelParts.join(' · ') || '—' })
        continue
      }
      if (seenInFile.has(key)) {
        invalidRows.push({ row: r.rowNumber, reason: 'Combinação duplicada dentro desta própria planilha.' })
        continue
      }
      seenInFile.add(key)

      toCreate.push({
        rowNumber: r.rowNumber, label: labelParts.join(' · ') || '—', price: r.price,
        sku: r.sku, stock: r.stock, leadTime: r.leadTime, weight: r.weight, options,
      })
    }

    return NextResponse.json({
      productId,
      productName: product.name,
      totalRows: parsed.rows.length,
      toCreateCount: toCreate.length,
      duplicateCount: duplicateRows.length,
      invalidCount: invalidRows.length,
      rows: toCreate,
      duplicateRows,
      invalidRows,
    })
  } catch (err: any) {
    console.error('[produtos/variacoes/criar-em-massa/analisar] erro:', err)
    return NextResponse.json({ error: 'Erro ao ler a planilha. Verifique o arquivo e tente novamente.' }, { status: 500 })
  }
}
