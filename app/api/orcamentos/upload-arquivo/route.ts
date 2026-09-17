import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPgPool } from '@/lib/supabase/pg'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'

/*
 * Mesma allowlist/limite de app/api/pedidos/upload-arquivo/route.ts —
 * a arte de orçamento reutiliza exatamente as regras já validadas para
 * pedidos, sem inventar extensões ou limites novos.
 */
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'ai', 'eps', 'cdr', 'zip', 'rar']
const MAX_SIZE = 50 * 1024 * 1024

/**
 * POST /api/orcamentos/upload-arquivo
 * Upload autenticado de arte vinculada a um ITEM de orçamento (dashboard).
 * companyId nunca vem do client — é sempre derivado da sessão.
 *
 * Recebe multipart/form-data: file, budgetId, budgetItemId
 * Reutiliza o bucket "order-files" (mesmo de Pedidos), path:
 * {companyId}/budgets/{budgetId}/{budgetItemId}/{uuid}.{ext}
 * Retorna a linha criada em budget_item_files.
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
    const budgetId = String(formData.get('budgetId') ?? '')
    const budgetItemId = String(formData.get('budgetItemId') ?? '')

    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (!budgetId) return NextResponse.json({ error: 'Orçamento não informado' }, { status: 400 })
    if (!budgetItemId) return NextResponse.json({ error: 'Item não informado' }, { status: 400 })

    const pool = getPgPool()

    /* Confirma que o orçamento pertence à mesma empresa do usuário autenticado */
    const { rows: budgetRows } = await pool.query(
      'select id from public.budgets where id = $1 and company_id = $2 limit 1',
      [budgetId, companyId]
    )
    if (budgetRows.length === 0) {
      return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })
    }

    /* Confirma que o item pertence ao mesmo orçamento (evita anexar em item de outro orçamento/empresa) */
    const { rows: itemRows } = await pool.query(
      'select id from public.budget_items where id = $1 and budget_id = $2 limit 1',
      [budgetItemId, budgetId]
    )
    if (itemRows.length === 0) {
      return NextResponse.json({ error: 'Item do orçamento não encontrado' }, { status: 404 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json({ error: `Tipo de arquivo não permitido: .${ext}` }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 50MB.' }, { status: 400 })
    }

    const path = `${companyId}/budgets/${budgetId}/${budgetItemId}/${randomUUID()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('order-files')
      .upload(path, buffer, { upsert: true, contentType: file.type || undefined })
    if (uploadErr) {
      console.error('[orcamentos/upload-arquivo] storage upload:', uploadErr)
      return NextResponse.json({ error: `Upload error: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from('order-files').getPublicUrl(path)

    const { rows: fileRows } = await pool.query(
      `insert into public.budget_item_files (budget_item_id, budget_id, company_id, file_name, file_url, file_path, file_size, mime_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [budgetItemId, budgetId, companyId, file.name, urlData.publicUrl, path, file.size, file.type || null]
    )

    return NextResponse.json({ ok: true, file: fileRows[0] })
  } catch (err) {
    console.error('[orcamentos/upload-arquivo] unexpected:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
