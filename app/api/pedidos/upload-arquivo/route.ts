import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

    const { data: company, error: companyErr } = await (supabaseAdmin.from('companies') as any)
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (companyErr || !company) {
      return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })
    }
    const companyId = company.id as string

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const orderId = String(formData.get('orderId') ?? '')

    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (!orderId) return NextResponse.json({ error: 'Pedido não informado' }, { status: 400 })

    /* Confirma que o pedido pertence à mesma empresa do usuário autenticado */
    const { data: order, error: orderErr } = await (supabaseAdmin.from('orders') as any)
      .select('id')
      .eq('id', orderId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (orderErr || !order) {
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
      return NextResponse.json({ error: `Upload error: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from('order-files').getPublicUrl(path)

    const { data: fileRow, error: insertErr } = await (supabaseAdmin.from('order_files') as any)
      .insert([{
        order_id: orderId,
        company_id: companyId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: 'equipe',
      }])
      .select()
      .single()
    if (insertErr) {
      return NextResponse.json({ error: `Erro ao registrar arquivo: ${insertErr.message}` }, { status: 500 })
    }

    await (supabaseAdmin.from('order_art_events') as any).insert([{
      order_id: orderId,
      company_id: companyId,
      event_type: 'arte_enviada',
      description: `Arquivo enviado pela equipe: ${file.name}`,
      created_by: user.id,
    }])

    return NextResponse.json({ ok: true, file: fileRow })
  } catch (err) {
    console.error('[pedidos/upload-arquivo] unexpected:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
