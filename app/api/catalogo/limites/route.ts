import { NextResponse } from 'next/server'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'
import { checkUsageLimit } from '@/lib/subscription/check'

/**
 * GET /api/catalogo/limites
 * Feedback imediato de uso/limite de categorias e produtos publicados do
 * Catálogo Online, para a UI mostrar mensagens amigáveis antes de tentar
 * salvar (a checagem definitiva continua sendo o trigger no banco).
 */
export async function GET() {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const [categorias, produtos] = await Promise.all([
    checkUsageLimit(auth.companyId, 'categories', auth.plan.plan),
    checkUsageLimit(auth.companyId, 'published_products', auth.plan.plan),
  ])

  return NextResponse.json({ categorias, produtos })
}
