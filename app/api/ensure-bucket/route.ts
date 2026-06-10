import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * POST /api/ensure-bucket
 *
 * Garante que o bucket 'company-assets' existe.
 * O UPLOAD da logo é feito NESTA ROTA (server-side) usando supabaseAdmin,
 * que possui service role e ignora RLS — evitando o erro de policy.
 *
 * Recebe: multipart/form-data com campo 'file' e 'companyId'
 * Retorna: { ok: true, url: string }
 */
export async function POST(request: Request) {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const formData = await request.formData()
    const file      = formData.get('file') as File | null
    const companyId = formData.get('companyId') as string | null

    /* ── Garantir bucket ── */
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.id === 'company-assets')

    if (!bucketExists) {
      const { error: bucketErr } = await supabaseAdmin.storage.createBucket('company-assets', {
        public: true,
        fileSizeLimit: 2097152,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      })
      if (bucketErr) {
        console.error('[ensure-bucket] create bucket:', bucketErr)
        return NextResponse.json({ error: `Bucket error: ${bucketErr.message}` }, { status: 500 })
      }
    }

    /* ── Se não tem arquivo, só garante o bucket ── */
    if (!file || !companyId) {
      return NextResponse.json({ ok: true, bucketReady: true })
    }

    /* ── Upload usando supabaseAdmin (service role ignora RLS) ── */
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `logos/${companyId}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('company-assets')
      .upload(path, buffer, {
        upsert:      true,
        contentType: file.type,
      })

    if (uploadErr) {
      console.error('[ensure-bucket] upload error:', uploadErr)
      return NextResponse.json({ error: `Upload error: ${uploadErr.message}` }, { status: 500 })
    }

    /* ── URL pública ── */
    const { data: urlData } = supabaseAdmin.storage
      .from('company-assets')
      .getPublicUrl(path)

    /* ── Salvar logo_url no banco ── */
    const { error: dbErr } = await (supabaseAdmin.from('companies') as any)
      .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', companyId)

    if (dbErr) {
      console.error('[ensure-bucket] db update:', dbErr)
      // Não falha — retorna a URL mesmo assim
    }

    return NextResponse.json({ ok: true, url: urlData.publicUrl })
  } catch (err) {
    console.error('[ensure-bucket] unexpected:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
