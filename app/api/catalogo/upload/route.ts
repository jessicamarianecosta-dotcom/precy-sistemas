import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 4 * 1024 * 1024

/**
 * POST /api/catalogo/upload
 * multipart/form-data: file, e (productId | context: 'logo'|'banner')
 *
 * Upload de fotos do Catálogo Online — bucket dedicado catalog-photos,
 * path sempre com o companyId resolvido da sessão (nunca do client),
 * mesmo padrão de segurança de app/api/ensure-bucket/route.ts.
 */
export async function POST(request: Request) {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const productId = String(formData.get('productId') ?? '')
  const context = String(formData.get('context') ?? '')

  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!productId && !['logo', 'banner'].includes(context)) {
    return NextResponse.json({ error: 'productId ou context (logo/banner) é obrigatório' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 4MB.' }, { status: 400 })
  }

  let folder = context
  if (productId) {
    // Confere que o produto pertence à empresa autenticada antes de gravar sob o path dela.
    const { data: product, error: productError } = await (supabaseAdmin.from('products') as any)
      .select('id')
      .eq('id', productId)
      .eq('company_id', auth.companyId)
      .single()
    if (productError || !product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }
    folder = productId
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${auth.companyId}/${folder}/${randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabaseAdmin.storage
    .from('catalog-photos')
    .upload(path, buffer, { upsert: true, contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: `Upload error: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage.from('catalog-photos').getPublicUrl(path)

  return NextResponse.json({ ok: true, url: urlData.publicUrl })
}
