import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024

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

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB.' }, { status: 400 })
  }

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${companyId}/checkout-arts/${randomUUID()}.${ext}`

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
