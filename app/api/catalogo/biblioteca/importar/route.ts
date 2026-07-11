import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'

/**
 * POST /api/catalogo/biblioteca/importar
 * Body: { ids: string[] }  — ids de public.library_products selecionados.
 *
 * Copia cada item da Biblioteca Precy+ (global) para o módulo Produtos da
 * empresa chamadora. O produto importado nasce NÃO publicado
 * (is_published_catalog=false — o lojista escolhe depois o que publicar) e
 * fica 100% independente: library_source_id é só metadado de auditoria,
 * nunca uma FK viva — editar/duplicar/apagar o produto não afeta a
 * biblioteca original, e apagar/alterar o item da biblioteca não afeta
 * produtos já importados.
 */
export async function POST(request: Request) {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um produto da biblioteca' }, { status: 400 })
  }

  const { data: libraryItems, error: libError } = await (supabaseAdmin.from('library_products') as any)
    .select('id, name, description, category_group, subcategory, photos, suggested_price, suggested_lead_time_days')
    .in('id', ids)
    .eq('is_active', true)

  if (libError) {
    return NextResponse.json({ error: `Erro ao buscar biblioteca: ${libError.message}` }, { status: 500 })
  }
  if (!libraryItems || libraryItems.length === 0) {
    return NextResponse.json({ error: 'Nenhum produto encontrado na biblioteca' }, { status: 404 })
  }

  const rows = libraryItems.map((item: any) => ({
    company_id: auth.companyId,
    name: item.name,
    description: item.description,
    category: item.subcategory,
    final_price: item.suggested_price ?? 0,
    catalog_photos: item.photos ?? [],
    catalog_starting_price: item.suggested_price ?? null,
    catalog_lead_time_days: item.suggested_lead_time_days ?? null,
    is_published_catalog: false,
    library_source_id: item.id,
  }))

  const { data: inserted, error: insertError } = await (supabaseAdmin.from('products') as any)
    .insert(rows)
    .select('id, name')

  if (insertError) {
    return NextResponse.json({ error: `Erro ao importar produtos: ${insertError.message}` }, { status: 500 })
  }

  return NextResponse.json({ imported: inserted?.length ?? 0, products: inserted })
}
