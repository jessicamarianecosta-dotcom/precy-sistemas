import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { buildVariantsWorkbook, type ExportVariantRow } from '@/lib/catalog/variantsExcel'
import type { GroupRow } from '@/lib/catalog/variationCombos'

/**
 * GET /api/produtos/variacoes/exportar?productId=...
 * Gera e devolve a planilha .xlsx com todas as combinações (ativas e
 * inativas) do produto — Produtos → Variações → "Exportar Excel".
 * Somente leitura: não grava nada no banco.
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
      .select('id, name, final_price')
      .eq('id', productId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (prodErr) throw prodErr
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const { data: groupRows, error: groupsErr } = await db
      .from('product_variation_groups')
      .select('id, name, sort_order, product_variation_options(id, group_id, value, sort_order, price_adjustment_type, price_adjustment_value)')
      .eq('product_id', productId)
      .order('sort_order')
      .order('sort_order', { foreignTable: 'product_variation_options' })
    if (groupsErr) throw groupsErr
    const groups: GroupRow[] = (groupRows ?? []).map((g: any) => ({
      id: g.id, name: g.name, sort_order: g.sort_order, options: g.product_variation_options ?? [],
    }))

    const { data: variantRows, error: variantsErr } = await db
      .from('product_variants')
      .select('id, sku, price, stock_quantity, lead_time_days, weight_kg, image_id, is_active, sort_order, product_variant_option_values(option_id, group_id)')
      .eq('product_id', productId)
      .order('sort_order')
    if (variantsErr) throw variantsErr

    if (!variantRows || variantRows.length === 0) {
      return NextResponse.json({ error: 'Este produto ainda não tem combinações cadastradas para exportar.' }, { status: 400 })
    }

    const { data: imageRows } = await db
      .from('product_images')
      .select('id, sort_order')
      .eq('product_id', productId)
      .order('sort_order')
    const imageIndexById = new Map<string, number>((imageRows ?? []).map((img: any, i: number) => [img.id, i]))

    const rows: ExportVariantRow[] = (variantRows as any[]).map(v => {
      const byGroup = new Map<string, string>((v.product_variant_option_values ?? []).map((ov: any) => [ov.group_id, ov.option_id]))
      const imgIdx = v.image_id ? imageIndexById.get(v.image_id) : undefined
      return {
        id: v.id,
        optionIdsByGroup: groups.map(g => byGroup.get(g.id)),
        is_active: v.is_active,
        sku: v.sku,
        stock_quantity: v.stock_quantity,
        lead_time_days: v.lead_time_days,
        weight_kg: v.weight_kg,
        image_label: imgIdx != null ? `Foto ${imgIdx + 1}` : 'Padrão',
        price: v.price != null ? Number(v.price) : null,
      }
    })

    const wb = buildVariantsWorkbook({
      productName: product.name,
      productPrice: Number(product.final_price ?? 0),
      groups,
      rows,
    })
    const buffer = await wb.xlsx.writeBuffer()

    const safeName = product.name
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .toLowerCase() || 'produto'

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="variacoes-${safeName}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('[produtos/variacoes/exportar] erro:', err)
    return NextResponse.json({ error: 'Erro ao gerar a planilha. Tente novamente.' }, { status: 500 })
  }
}
