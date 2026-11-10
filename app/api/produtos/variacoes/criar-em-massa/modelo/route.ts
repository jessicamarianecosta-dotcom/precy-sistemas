import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { buildCreateVariantsWorkbook } from '@/lib/catalog/variantsExcel'
import type { GroupRow } from '@/lib/catalog/variationCombos'

/**
 * GET /api/produtos/variacoes/criar-em-massa/modelo?productId=...
 * Gera o modelo .xlsx pra criar combinações em massa (Produtos → Variações
 * → "Baixar modelo"): uma coluna de texto livre por grupo já cadastrado no
 * produto + colunas extras em branco pra grupos novos (a pessoa escreve o
 * nome do grupo que quiser no cabeçalho). Somente leitura — funciona mesmo
 * para um produto que ainda não tem nenhum grupo de variação.
 */
export async function GET(request: Request) {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const companyId = await resolveCompanyIdForUser(user.id)
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    if (!productId) return NextResponse.json({ error: 'productId é obrigatório' }, { status: 400 })

    const db = supabaseAdmin as any

    const { data: product, error: prodErr } = await db
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (prodErr) throw prodErr
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const { data: groupRows, error: groupsErr } = await db
      .from('product_variation_groups')
      .select('id, name, sort_order, is_required, product_variation_options(id, group_id, value, sort_order)')
      .eq('product_id', productId)
      .order('sort_order')
      .order('sort_order', { foreignTable: 'product_variation_options' })
    if (groupsErr) throw groupsErr

    const groups: GroupRow[] = (groupRows ?? []).map((g: any) => ({
      id: g.id, name: g.name, sort_order: g.sort_order, is_required: g.is_required ?? true,
      options: g.product_variation_options ?? [],
    }))

    const wb = buildCreateVariantsWorkbook({ productName: product.name, existingGroups: groups })
    const buffer = await wb.xlsx.writeBuffer()

    const safeName = product.name
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .toLowerCase() || 'produto'

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="modelo-combinacoes-${safeName}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('[produtos/variacoes/criar-em-massa/modelo] erro:', err)
    return NextResponse.json({ error: 'Erro ao gerar o modelo. Tente novamente.' }, { status: 500 })
  }
}
