import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'

const MAX_UPDATES = 5000

/**
 * POST /api/produtos/variacoes/importar/confirmar
 * Body: { productId, updates: [{ id, price }] }
 * Aplica em lote o novo preço-base das combinações já validadas pela tela de
 * prévia (.../importar/analisar). A gravação em si roda dentro da função
 * SQL bulk_update_variant_prices (migration 089): se qualquer linha falhar
 * (id inexistente, preço negativo, produto de outra empresa), TODA a
 * importação é desfeita — nunca atualização parcial.
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

    const sanitized = updatesInput.map((u: any) => ({ id: String(u?.id ?? ''), price: Number(u?.price) }))
    if (sanitized.some((u: { id: string; price: number }) => !u.id || !Number.isFinite(u.price))) {
      return NextResponse.json({ error: 'Dados de atualização inválidos. Refaça a importação a partir da prévia.' }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin as any).rpc('bulk_update_variant_prices', {
      p_product_id: productId,
      p_company_id: companyId,
      p_updates: sanitized,
    })

    if (error) {
      console.error('[produtos/variacoes/importar/confirmar] rpc erro:', error)
      return NextResponse.json({ error: error.message || 'Não foi possível importar os preços. Nenhuma alteração foi salva.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, updatedCount: data })
  } catch (err: any) {
    console.error('[produtos/variacoes/importar/confirmar] erro:', err)
    return NextResponse.json({ error: 'Erro ao salvar as alterações. Nenhuma alteração foi aplicada.' }, { status: 500 })
  }
}
