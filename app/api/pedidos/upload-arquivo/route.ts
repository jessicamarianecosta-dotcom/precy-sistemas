import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPgPool } from '@/lib/supabase/pg'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'ai', 'eps', 'cdr', 'zip', 'rar']
const MAX_SIZE = 50 * 1024 * 1024

/**
 * POST /api/pedidos/upload-arquivo
 * Upload autenticado de arquivo de arte direto no dashboard (Pedidos).
 * Mesmo padrão de app/api/ensure-bucket/route.ts: companyId nunca vem do
 * client, é sempre derivado da sessão (auth.uid() → companies.user_id).
 *
 * Recebe multipart/form-data: file, orderId
 * Retorna a linha criada em order_files.
 */
export async function POST(request: Request) {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const companyId = await resolveCompanyIdForUser(user.id)
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const orderId = String(formData.get('orderId') ?? '')

    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (!orderId) return NextResponse.json({ error: 'Pedido não informado' }, { status: 400 })

    /* Confirma que o pedido pertence à mesma empresa do usuário autenticado */
    const pool = getPgPool()
    const { rows: orderRows } = await pool.query(
      'select id from public.orders where id = $1 and company_id = $2 limit 1',
      [orderId, companyId]
    )
    if (orderRows.length === 0) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json({ error: `Tipo de arquivo não permitido: .${ext}` }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 50MB.' }, { status: 400 })
    }

    const path = `${companyId}/${orderId}/${randomUUID()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('order-files')
      .upload(path, buffer, { upsert: true, contentType: file.type || undefined })
    if (uploadErr) {
      console.error('[pedidos/upload-arquivo] storage upload:', uploadErr)
      return NextResponse.json({ error: `Upload error: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from('order-files').getPublicUrl(path)

    const { rows: fileRows } = await pool.query(
      `insert into public.order_files (order_id, company_id, file_name, file_url, file_path, file_size, mime_type, uploaded_by)
       values ($1, $2, $3, $4, $5, $6, $7, 'equipe')
       returning *`,
      [orderId, companyId, file.name, urlData.publicUrl, path, file.size, file.type || null]
    )
    const fileRow = fileRows[0]

    await pool.query(
      `insert into public.order_art_events (order_id, company_id, event_type, description, created_by)
       values ($1, $2, 'arte_enviada', $3, $4)`,
      [orderId, companyId, `Arquivo enviado pela equipe: ${file.name}`, user.id]
    )

    return NextResponse.json({ ok: true, file: fileRow })
  } catch (err) {
    console.error('[pedidos/upload-arquivo] unexpected:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
