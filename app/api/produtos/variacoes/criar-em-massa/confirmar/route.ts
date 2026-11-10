import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { parseCreateVariantsWorkbook, planCreateVariants, type GroupPlanEntry } from '@/lib/catalog/variantsExcel'
import { comboKey, type GroupRow } from '@/lib/catalog/variationCombos'

const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * POST /api/produtos/variacoes/criar-em-massa/confirmar
 * Body: multipart/form-data { file, productId } — o MESMO arquivo enviado a
 * .../analisar. Reprocessa do zero (reparse + planCreateVariants) em vez de
 * confiar em IDs calculados na prévia: um grupo/opção "novo" ainda não tem
 * ID nenhum até ser criado aqui, e reprocessar garante que a prévia e o que
 * de fato é gravado nunca divirjam, mesmo se algo mudou no produto entre as
 * duas chamadas.
 *
 * 1. Cria os grupos/opções que a prévia já apontou como novos (não
 *    transacional com o passo 2 — mas é sempre seguro: criar um grupo ou
 *    opção nunca corrompe nada, na pior hipótese sobra um grupo/opção sem
 *    uso se o passo 2 falhar, sem apagar ou duplicar o que já existia).
 * 2. Cria as combinações em lote de forma transacional via a função SQL
 *    bulk_create_variants (migration 101) — se qualquer linha falhar, TODA
 *    a criação de combinações é desfeita.
 * Nunca atualiza nem apaga combinação, grupo ou opção já existentes.
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

    const plan = planCreateVariants(parsed.groupNames, parsed.rows, existingGroups)
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 422 })

    const { data: existingVariants } = await db
      .from('product_variants')
      .select('id, product_variant_option_values(option_id, group_id)')
      .eq('product_id', productId)
    const existingKeys = new Set<string>((existingVariants ?? []).map((v: any) => {
      const byGroup = new Map<string, string>((v.product_variant_option_values ?? []).map((ov: any) => [ov.group_id, ov.option_id]))
      return comboKey(plan.groupsPlan.map(g => (g.existingId ? byGroup.get(g.existingId) : undefined)))
    }))

    // ── Passo 1: cria grupos e opções novos ──────────────────────────
    // group_id/option_id resolvidos (existentes + recém-criados), por
    // índice do grupo em plan.groupsPlan.
    const resolvedGroupIds: string[] = []
    let nextGroupSortOrder = existingGroups.length > 0 ? Math.max(...existingGroups.map(g => g.sort_order)) + 1 : 0

    for (const g of plan.groupsPlan) {
      if (g.existingId) { resolvedGroupIds.push(g.existingId); continue }
      const { data: newGroup, error: gErr } = await db
        .from('product_variation_groups')
        .insert({ product_id: productId, company_id: companyId, name: g.name, sort_order: nextGroupSortOrder++, is_required: g.isRequired })
        .select('id').single()
      if (gErr) throw gErr
      resolvedGroupIds.push(newGroup.id)
    }

    const resolvedOptionIdByGroupAndValue: Map<string, string>[] = []
    for (let i = 0; i < plan.groupsPlan.length; i++) {
      const g: GroupPlanEntry = plan.groupsPlan[i]
      const groupId = resolvedGroupIds[i]
      const map = new Map<string, string>()
      let nextOptionSortOrder = [...g.options.values()].filter(o => o.existingId).length
      for (const [valueLower, opt] of g.options) {
        if (opt.existingId) { map.set(valueLower, opt.existingId); continue }
        const { data: newOption, error: oErr } = await db
          .from('product_variation_options')
          .insert({ group_id: groupId, company_id: companyId, value: opt.value, sort_order: nextOptionSortOrder++ })
          .select('id').single()
        if (oErr) throw oErr
        map.set(valueLower, newOption.id)
      }
      resolvedOptionIdByGroupAndValue.push(map)
    }

    // ── Passo 2: monta as linhas a criar (pulando duplicatas) e grava em lote ──
    const rpcRows: Record<string, unknown>[] = []
    for (const row of plan.rows) {
      const options: { group_id: string; option_id: string }[] = []
      plan.groupsPlan.forEach((_, idx) => {
        const val = row.valueByFinalGroup[idx]
        if (val == null) return
        const optionId = resolvedOptionIdByGroupAndValue[idx].get(val.trim().toLowerCase())
        if (optionId) options.push({ group_id: resolvedGroupIds[idx], option_id: optionId })
      })

      const rowKey = comboKey(plan.groupsPlan.map((_, idx) => {
        const val = row.valueByFinalGroup[idx]
        return val == null ? undefined : resolvedOptionIdByGroupAndValue[idx].get(val.trim().toLowerCase())
      }))
      if (existingKeys.has(rowKey)) continue // já existe — não duplica

      const patch: Record<string, unknown> = { price: row.price, options }
      if (row.sku) patch.sku = row.sku
      if (row.stock != null) patch.stock_quantity = row.stock
      if (row.leadTime != null) patch.lead_time_days = row.leadTime
      if (row.weight != null) patch.weight_kg = row.weight
      rpcRows.push(patch)
    }

    if (rpcRows.length === 0) {
      return NextResponse.json({ ok: true, createdCount: 0, groupsCreated: plan.groupsPlan.filter(g => !g.existingId).length })
    }

    const { data: createdCount, error: rpcErr } = await db.rpc('bulk_create_variants', {
      p_product_id: productId,
      p_company_id: companyId,
      p_rows: rpcRows,
    })
    if (rpcErr) {
      console.error('[produtos/variacoes/criar-em-massa/confirmar] rpc erro:', rpcErr)
      return NextResponse.json({ error: rpcErr.message || 'Grupos/opções novos foram criados, mas não foi possível criar as combinações. Confira a tela de Variações e tente importar de novo.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, createdCount, groupsCreated: plan.groupsPlan.filter(g => !g.existingId).length })
  } catch (err: any) {
    console.error('[produtos/variacoes/criar-em-massa/confirmar] erro:', err)
    return NextResponse.json({ error: 'Erro ao salvar as combinações. Tente novamente — grupos/opções já criados não são duplicados numa nova tentativa.' }, { status: 500 })
  }
}
