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
 * SEGURANÇA: o companyId NUNCA é aceito do client. É sempre derivado
 * da sessão autenticada (auth.uid() → companies.user_id), exatamente
 * como as rotas /api/stripe/*. Isso evita que uma usuária autenticada
 * sobrescreva o logo de outra empresa enviando um companyId arbitrário.
 *
 * Recebe: multipart/form-data com campo 'file' (companyId é ignorado se enviado)
 * Retorna: { ok: true, url: string }
 */
export async function POST(request: Request) {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    /* ── Resolver companyId a partir da sessão — nunca do client ── */
    const { data: company, error: companyErr } = await (supabaseAdmin.from('companies') as any)
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (companyErr || !company) {
      return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })
    }
    const companyId = company.id as string

    const formData = await request.formData()
    const file      = formData.get('file') as File | null

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
    if (!file) {
      return NextResponse.json({ ok: true, bucketReady: true })
    }

    /* ── Validar tipo/tamanho no servidor (defesa em profundidade) ── */
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 2MB.' }, { status: 400 })
    }

    /* ── Upload usando supabaseAdmin (service role ignora RLS) ──
       path SEMPRE usa o companyId resolvido da sessão, não do client */
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

    /* ── Salvar logo_url no banco (mesma empresa resolvida acima) ── */
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
