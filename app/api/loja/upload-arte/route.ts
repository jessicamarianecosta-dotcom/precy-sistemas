import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'

// Validação por extensão (não por mime type): .ai/.cdr não têm um mime_type
// padronizado entre navegadores, e o bucket 'order-files' não usa allowlist
// de mime por isso mesmo (ver migration 054).
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'ai', 'eps', 'cdr', 'zip', 'rar']
const MAX_SIZE = 50 * 1024 * 1024

/**
 * POST /api/loja/upload-arte
 * Rota pública (checkout da loja) — multipart/form-data: file, slug
 *
 * Visitantes anônimos não têm sessão/RLS, então o upload passa sempre por
 * aqui (supabaseAdmin, service role) — nunca direto do client para o
 * Storage. O companyId é resolvido pelo slug da loja, nunca aceito do
 * client diretamente.
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const slug = String(formData.get('slug') ?? '')

  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!slug) return NextResponse.json({ error: 'Loja não informada' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json({ error: `Tipo de arquivo não permitido: .${ext}` }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 50MB.' }, { status: 400 })
  }

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
  }

  const path = `${companyId}/checkout-arts/${randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabaseAdmin.storage
    .from('order-files')
    .upload(path, buffer, { upsert: true, contentType: file.type || undefined })

  if (uploadError) {
    return NextResponse.json({ error: `Upload error: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage.from('order-files').getPublicUrl(path)
  return NextResponse.json({
    ok: true,
    url: urlData.publicUrl,
    path,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || null,
  })
}
