import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'

const MAX_UPDATES = 5000

/** Campos que a importação pode atualizar — espelha o que bulk_update_variant_fields (migration 098) aceita. */
const EDITABLE_FIELDS = ['price', 'sku', 'stock_quantity', 'lead_time_days', 'weight_kg', 'is_active'] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

/**
 * POST /api/produtos/variacoes/importar/confirmar
 * Body: { productId, updates: [{ id, price?, sku?, stock_quantity?, lead_time_days?, weight_kg?, is_active? }] }
 * Aplica em lote os campos editados das combinações já validadas pela tela
 * de prévia (.../importar/analisar) — cada item só traz os campos que de
 * fato mudaram. A gravação em si roda dentro da função SQL
 * bulk_update_variant_fields (migration 098): se qualquer linha falhar (id
 * inexistente, valor negativo, produto de outra empresa), TODA a importação
 * é desfeita — nunca atualização parcial.
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
    const updatesInput = Array.isArray(body?.updates) ? body.updates : []

    if (!productId) return NextResponse.json({ error: 'productId é obrigatório.' }, { status: 400 })
    if (updatesInput.length === 0) return NextResponse.json({ error: 'Nenhuma atualização para aplicar.' }, { status: 400 })
    if (updatesInput.length > MAX_UPDATES) {
      return NextResponse.json({ error: `Muitas linhas para importar de uma vez (máximo ${MAX_UPDATES}).` }, { status: 400 })
    }

    const sanitized: { id: string; patch: Record<string, unknown> }[] = updatesInput.map((u: any) => {
      const id = String(u?.id ?? '')
      const patch: Record<string, unknown> = { id }
      for (const field of EDITABLE_FIELDS) {
        if (!(field in (u ?? {}))) continue
        const raw = u[field]
        if (field === 'is_active') patch[field] = Boolean(raw)
        else if (field === 'sku') patch[field] = raw == null ? null : String(raw)
        else patch[field] = raw == null ? null : Number(raw)
      }
      return { id, patch }
    })
    if (sanitized.some(u => !u.id)) {
      return NextResponse.json({ error: 'Dados de atualização inválidos. Refaça a importação a partir da prévia.' }, { status: 400 })
    }
    const numericFields: EditableField[] = ['price', 'stock_quantity', 'lead_time_days', 'weight_kg']
    if (sanitized.some(u => numericFields.some(f => f in u.patch && u.patch[f] != null && !Number.isFinite(u.patch[f] as number)))) {
      return NextResponse.json({ error: 'Dados de atualização inválidos. Refaça a importação a partir da prévia.' }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin as any).rpc('bulk_update_variant_fields', {
      p_product_id: productId,
      p_company_id: companyId,
      p_updates: sanitized.map(u => u.patch),
    })

    if (error) {
      console.error('[produtos/variacoes/importar/confirmar] rpc erro:', error)
      return NextResponse.json({ error: error.message || 'Não foi possível importar as alterações. Nenhuma alteração foi salva.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, updatedCount: data })
  } catch (err: any) {
    console.error('[produtos/variacoes/importar/confirmar] erro:', err)
    return NextResponse.json({ error: 'Erro ao salvar as alterações. Nenhuma alteração foi aplicada.' }, { status: 500 })
  }
}
