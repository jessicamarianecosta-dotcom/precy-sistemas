import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireCatalogImportAccess } from '@/lib/catalog/importServerAuth'
import { parseCatalogText, normalizeForMatch, type ParsedCatalogItem } from '@/lib/catalog/pdfCatalogParser'

const MAX_TEXT_LENGTH = 500_000

export interface AnalyzedCatalogItem extends ParsedCatalogItem {
  duplicateOf: { id: string; name: string } | null
}

/**
 * POST /api/produtos/importar-catalogo/analisar
 * Body: { filename: string, text: string } — texto já extraído do PDF no
 * client (lib/pdf/extractCatalogPdfText.ts). Não faz nenhuma escrita: só
 * interpreta o texto e devolve a lista para a tela de pré-visualização
 * (Produtos → Importar Catálogo). Exclusivo da conta autorizada — ver
 * lib/catalog/importServerAuth.ts.
 */
export async function POST(request: Request) {
  const auth = await requireCatalogImportAccess()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const filename = typeof body?.filename === 'string' ? body.filename : 'catalogo.pdf'
  const text = typeof body?.text === 'string' ? body.text : ''

  if (!text.trim()) {
    return NextResponse.json({ error: 'Não foi possível extrair texto deste PDF. Se ele for uma imagem escaneada, a importação automática não é suportada.' }, { status: 400 })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'Arquivo muito extenso para análise.' }, { status: 413 })
  }

  const parsed = parseCatalogText(text)
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'Nenhum produto foi identificado neste PDF. Verifique se o catálogo lista preços no formato R$ 0,00 por item.' }, { status: 422 })
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
    duplicateOf: existingByKey.get(normalizeForMatch(item.name)) ?? null,
  }))

  return NextResponse.json({ filename, totalFound: items.length, items })
}
