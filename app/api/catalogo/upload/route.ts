import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'
import { sniffMimeType } from '@/lib/catalog/mediaSniff'

const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_TYPES_BY_CONTEXT: Record<string, string[]> = {
  product: ['image/jpeg', 'image/png', 'image/webp'],
  'product-video': ['video/mp4'],
}
const MAX_SIZE_BY_CONTEXT: Record<string, number> = {
  logo:          2 * 1024 * 1024,
  banner:        5 * 1024 * 1024,
  seo:           5 * 1024 * 1024,
  product:       10 * 1024 * 1024,
  'product-video': 25 * 1024 * 1024,
}
const DEFAULT_MAX_SIZE = 4 * 1024 * 1024
// Margem pequena sobre os 20s pedidos — a duração em si é medida no
// navegador (ver ProductGalleryUpload) e enviada aqui só para registro;
// o servidor não decodifica vídeo, então não consegue medir a duração real
// sem um binário externo (ffprobe) que não está disponível neste ambiente.
// Essa limitação está documentada — ver nota abaixo.
const MAX_VIDEO_DURATION_SECONDS = 20.5

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
  const mediaType = String(formData.get('mediaType') ?? 'image') === 'video' ? 'video' : 'image'
  const context = mediaType === 'video' ? 'product-video' : String(formData.get('context') ?? '')
  // Duração medida no navegador (ver ProductGalleryUpload) — só usada para
  // rejeitar vídeos claramente acima do limite antes de gastar banda/Storage;
  // não é prova criptográfica de duração (ver nota do limite acima).
  const clientDuration = formData.get('duration') != null ? Number(formData.get('duration')) : null

  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!productId && !['logo', 'banner', 'seo', 'product'].includes(context)) {
    return NextResponse.json({ error: 'productId ou context (logo/banner/seo/product) é obrigatório' }, { status: 400 })
  }
  if (mediaType === 'video' && !productId) {
    return NextResponse.json({ error: 'productId é obrigatório para vídeo' }, { status: 400 })
  }

  const allowedTypes = ALLOWED_TYPES_BY_CONTEXT[context] ?? DEFAULT_ALLOWED_TYPES
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 })
  }
  const maxSize = MAX_SIZE_BY_CONTEXT[context] ?? DEFAULT_MAX_SIZE
  if (file.size > maxSize) {
    return NextResponse.json({ error: `Arquivo muito grande. Máximo ${Math.round(maxSize / (1024 * 1024))}MB.` }, { status: 400 })
  }
  if (mediaType === 'video' && clientDuration != null && Number.isFinite(clientDuration) && clientDuration > MAX_VIDEO_DURATION_SECONDS) {
    return NextResponse.json({ error: 'O vídeo deve ter no máximo 20 segundos.' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Nunca confia só na extensão/`file.type` (ambos vêm do client) — confere
  // os bytes reais do arquivo antes de gravar qualquer coisa no Storage.
  const sniffed = sniffMimeType(buffer)
  if (!sniffed || !allowedTypes.includes(sniffed)) {
    return NextResponse.json({ error: 'O conteúdo do arquivo não corresponde a um formato permitido.' }, { status: 400 })
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

  const extByMime: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4',
  }
  const ext = extByMime[sniffed] ?? 'bin'
  const path = `${auth.companyId}/${folder}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('catalog-photos')
    .upload(path, buffer, { upsert: true, contentType: sniffed })

  if (uploadError) {
    return NextResponse.json({ error: `Upload error: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage.from('catalog-photos').getPublicUrl(path)

  return NextResponse.json({
    ok: true,
    url: urlData.publicUrl,
    path,
    mimeType: sniffed,
    fileSize: buffer.length,
  })
}

/**
 * DELETE /api/catalogo/upload  body: { path }
 * Apaga um arquivo do bucket catalog-photos — só quando nenhuma outra linha
 * de product_images ainda referencia o mesmo storage_path (evita apagar um
 * arquivo reutilizado por outro produto/variação) e só dentro da pasta da
 * própria empresa (primeiro segmento do path = company_id da sessão).
 */
export async function DELETE(request: Request) {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const path = String(body?.path ?? '')
  if (!path) return NextResponse.json({ error: 'path é obrigatório' }, { status: 400 })

  if (!path.startsWith(`${auth.companyId}/`)) {
    return NextResponse.json({ error: 'Arquivo não pertence a esta empresa' }, { status: 403 })
  }

  const { count } = await (supabaseAdmin.from('product_images') as any)
    .select('id', { count: 'exact', head: true })
    .eq('storage_path', path)

  if ((count ?? 0) > 0) {
    // Ainda referenciado (ex.: a própria linha que está sendo removida em
    // paralelo, ou reaproveitado por outra variação) — não apaga do Storage.
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { error } = await supabaseAdmin.storage.from('catalog-photos').remove([path])
  if (error) {
    return NextResponse.json({ error: `Erro ao remover arquivo: ${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
