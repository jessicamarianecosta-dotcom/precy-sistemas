import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'

const MAX_ROWS = 2000

/**
 * POST /api/produtos/variacoes/criar-em-massa/confirmar
 * Body: { productId, rows: [{ price, sku?, stock?, leadTime?, weight?, options: [{group_id, option_id}] }] }
 * Cria em lote as combinações já validadas pela prévia
 * (.../criar-em-massa/analisar). A gravação roda dentro da função SQL
 * bulk_create_variants (migration 101): se qualquer linha falhar, TODA a
 * criação é desfeita — nunca criação parcial. Só cria; nunca atualiza ou
 * apaga combinações existentes.
 */
export async function POST(request: Request) {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const companyId = await resolveCompanyIdForUser(user.id)
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })

    const body = await request.json().catch(() => null)
    const productId = String(body?.productId ?? '')
    const rowsInput = Array.isArray(body?.rows) ? body.rows : []

    if (!productId) return NextResponse.json({ error: 'productId é obrigatório.' }, { status: 400 })
    if (rowsInput.length === 0) return NextResponse.json({ error: 'Nenhuma combinação para criar.' }, { status: 400 })
    if (rowsInput.length > MAX_ROWS) {
      return NextResponse.json({ error: `Muitas combinações para criar de uma vez (máximo ${MAX_ROWS}).` }, { status: 400 })
    }

    const sanitized = rowsInput.map((r: any) => {
      const row: Record<string, unknown> = { price: Number(r?.price) }
      if (r?.sku) row.sku = String(r.sku)
      if (r?.stock != null) row.stock_quantity = Number(r.stock)
      if (r?.leadTime != null) row.lead_time_days = Number(r.leadTime)
      if (r?.weight != null) row.weight_kg = Number(r.weight)
      row.options = Array.isArray(r?.options)
        ? r.options.map((o: any) => ({ group_id: String(o?.group_id ?? ''), option_id: String(o?.option_id ?? '') }))
        : []
      return row
    })
    const invalid = sanitized.some((r: any) =>
      !Number.isFinite(r.price) || r.price < 0 ||
      r.options.some((o: any) => !o.group_id || !o.option_id)
    )
    if (invalid) {
      return NextResponse.json({ error: 'Dados inválidos. Refaça a importação a partir da prévia.' }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin as any).rpc('bulk_create_variants', {
      p_product_id: productId,
      p_company_id: companyId,
      p_rows: sanitized,
    })

    if (error) {
      console.error('[produtos/variacoes/criar-em-massa/confirmar] rpc erro:', error)
      return NextResponse.json({ error: error.message || 'Não foi possível criar as combinações. Nenhuma foi salva.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, createdCount: data })
  } catch (err: any) {
    console.error('[produtos/variacoes/criar-em-massa/confirmar] erro:', err)
    return NextResponse.json({ error: 'Erro ao salvar as combinações. Nenhuma alteração foi aplicada.' }, { status: 500 })
  }
}
