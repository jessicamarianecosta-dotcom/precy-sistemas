import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireCatalogImportAccess } from '@/lib/catalog/importServerAuth'
import { parseCatalogPages, normalizeForMatch, type ParsedCatalogItem } from '@/lib/catalog/pdfCatalogParser'
import type { PdfPageLines } from '@/lib/pdf/extractCatalogPdfText'

const MAX_PAGES = 200
const MAX_LINES_PER_PAGE = 2000

export interface AnalyzedCatalogItem extends ParsedCatalogItem {
  duplicateOf: { id: string; name: string } | null
}

/**
 * POST /api/produtos/importar-catalogo/analisar
 * Body: { filename: string, pages: PdfPageLines[] } — estrutura já extraída
 * do PDF no client (lib/pdf/extractCatalogPdfText.ts): linhas com posição
 * (x, y, fontSize), não um texto solto. O parser (lib/catalog/
 * pdfCatalogParser.ts) usa essa estrutura para agrupar blocos de produto
 * completos, em vez de tratar qualquer linha com preço como produto.
 *
 * Não faz nenhuma escrita: só interpreta e devolve a lista para a tela de
 * pré-visualização (Produtos → Importar Catálogo). Exclusivo da conta
 * autorizada — ver lib/catalog/importServerAuth.ts.
 */
export async function POST(request: Request) {
  const auth = await requireCatalogImportAccess()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const filename = typeof body?.filename === 'string' ? body.filename : 'catalogo.pdf'
  const pagesInput = Array.isArray(body?.pages) ? (body.pages as PdfPageLines[]) : []

  if (pagesInput.length === 0) {
    return NextResponse.json({ error: 'Não foi possível ler a estrutura deste PDF. Se ele for uma imagem escaneada, a importação automática não é suportada.' }, { status: 400 })
  }
  if (pagesInput.length > MAX_PAGES) {
    return NextResponse.json({ error: `PDF com muitas páginas (máximo ${MAX_PAGES}).` }, { status: 413 })
  }
  for (const p of pagesInput) {
    if (!Array.isArray(p?.lines) || p.lines.length > MAX_LINES_PER_PAGE) {
      return NextResponse.json({ error: 'Estrutura de página inválida ou excessiva.' }, { status: 400 })
    }
  }

  const totalLines = pagesInput.reduce((s, p) => s + p.lines.length, 0)
  if (totalLines === 0) {
    return NextResponse.json({ error: 'Nenhum texto encontrado neste PDF. Se ele for uma imagem escaneada, a importação automática não é suportada.' }, { status: 400 })
  }

  const parsed = parseCatalogPages(pagesInput)
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'Nenhum produto foi identificado neste PDF. Verifique se o catálogo lista preços no formato R$ 0,00 próximo ao nome de cada item.' }, { status: 422 })
  }

  const { data: existing } = await (supabaseAdmin.from('products') as any)
    .select('id, name')
    .eq('company_id', auth.companyId)

  const existingByKey = new Map<string, { id: string; name: string }>()
  for (const p of (existing ?? []) as { id: string; name: string }[]) {
    existingByKey.set(normalizeForMatch(p.name), { id: p.id, name: p.name })
  }

  const items: AnalyzedCatalogItem[] = parsed.map(item => ({
    ...item,
    duplicateOf: item.name ? existingByKey.get(normalizeForMatch(item.name)) ?? null : null,
  }))

  const reviewCount = items.filter(i => i.needsReview).length

  return NextResponse.json({
    filename,
    pageCount: pagesInput.length,
    totalFound: items.length,
    reviewCount,
    items,
  })
}
