import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { parseCreateVariantsWorkbook, planCreateVariants } from '@/lib/catalog/variantsExcel'
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
}
export interface CreateBulkInvalidRow { row: number; reason: string }
export interface CreateBulkGroupPlan {
  name: string
  isNew: boolean
  isRequired: boolean
  newOptionsCount: number
  totalOptionsCount: number
}

/**
 * POST /api/produtos/variacoes/criar-em-massa/analisar
 * Body: multipart/form-data { file, productId }
 * Lê o modelo (colunas de grupo com nome livre), reconcilia contra os
 * grupos/opções ATUAIS do produto (planCreateVariants — a MESMA função que
 * .../confirmar usa, pra prévia e confirmação nunca divergirem), identifica
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
    const existingGroups: GroupRow[] = (groupRows ?? []).map((g: any) => ({
      id: g.id, name: g.name, sort_order: g.sort_order, is_required: g.is_required ?? true,
      options: g.product_variation_options ?? [],
    }))

    const arrayBuffer = await file.arrayBuffer()
    const parsed = await parseCreateVariantsWorkbook(arrayBuffer)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 })
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha preenchida foi encontrada nesta planilha.' }, { status: 422 })
    }

    const plan = planCreateVariants(parsed.groupNames, parsed.rows, existingGroups)
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 422 })

    // Combinações já existentes — nunca duplica. Monta a chave de cada
    // combinação (salva ou da planilha) na MESMA ordem de plan.groupsPlan
    // (grupos existentes primeiro, novos depois): um grupo novo contribui
    // sempre com undefined pro lado das combinações já salvas (nenhuma delas
    // pode referenciar um grupo que ainda não existia), e com o id real da
    // opção (já existente ou recém-vista) pro lado da planilha — strings
    // sintéticas (`new:grupo:valor`) nunca coincidem com um UUID salvo, então
    // uma linha que usa uma opção nova nunca é apontada como duplicata.
    const { data: existingVariants } = await db
      .from('product_variants')
      .select('id, product_variant_option_values(option_id, group_id)')
      .eq('product_id', productId)
    const existingKeys = new Set<string>((existingVariants ?? []).map((v: any) => {
      const byGroup = new Map<string, string>((v.product_variant_option_values ?? []).map((ov: any) => [ov.group_id, ov.option_id]))
      return comboKey(plan.groupsPlan.map(g => (g.existingId ? byGroup.get(g.existingId) : undefined)))
    }))

    const invalidRows: CreateBulkInvalidRow[] = [...plan.invalidRows]
    const duplicateRows: { row: number; label: string }[] = []
    const toCreate: CreateBulkPreviewRow[] = []
    const seenInFile = new Set<string>()

    for (const row of plan.rows) {
      const labelParts: string[] = []
      const rowKeyParts = plan.groupsPlan.map((g, idx) => {
        const val = row.valueByFinalGroup[idx]
        if (val == null) return undefined
        labelParts.push(`${g.name}: ${val}`)
        const existingOptionId = g.options.get(val.trim().toLowerCase())?.existingId
        return existingOptionId ?? `new:${g.name}:${val}`
      })
      const label = labelParts.join(' · ') || '—'
      const rowKey = comboKey(rowKeyParts)

      if (existingKeys.has(rowKey)) {
        duplicateRows.push({ row: row.rowNumber, label })
        continue
      }
      if (seenInFile.has(rowKey)) {
        invalidRows.push({ row: row.rowNumber, reason: 'Combinação duplicada dentro desta própria planilha.' })
        continue
      }
      seenInFile.add(rowKey)

      toCreate.push({
        rowNumber: row.rowNumber, label, price: row.price,
        sku: row.sku, stock: row.stock, leadTime: row.leadTime, weight: row.weight,
      })
    }

    const groupsPlanOut: CreateBulkGroupPlan[] = plan.groupsPlan.map(g => ({
      name: g.name,
      isNew: g.existingId === null,
      isRequired: g.isRequired,
      newOptionsCount: [...g.options.values()].filter(o => o.existingId === null).length,
      totalOptionsCount: g.options.size,
    }))

    return NextResponse.json({
      productId,
      productName: product.name,
      groupsPlan: groupsPlanOut,
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
