import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { createApprovalToken, encryptApprovalToken, ART_FINISHING_INSTRUCTIONS, ART_FINISHING_INSTRUCTIONS_VERSION, hasDigitalArtApprovalBeta } from '@/lib/orders/digitalArtApproval'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

/**
 * Transforma um arquivo já enviado (em "Arquivos do Cliente") numa arte
 * aprovável: cria o link se ainda não existir, grava a arte vinculada ao
 * item escolhido (ou nenhum, para "arte geral do pedido") e a versão 1
 * com cópia privada do arquivo, igual ao fluxo antigo por item.
 */
export async function POST(request: Request) {
  try {
    const auth = createServerComponentClient({ cookies }); const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasDigitalArtApprovalBeta(user.email)) return NextResponse.json({ error: 'Recurso indisponível.' }, { status: 404 })
    const companyId = await resolveCompanyIdForUser(user.id); if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    const body = await request.json()
    const orderId = String(body.orderId ?? '')
    const fileId = String(body.fileId ?? '')
    const itemId = body.itemId ? String(body.itemId) : null
    const label = body.label ? String(body.label).trim().slice(0, 120) : null
    if (!orderId || !fileId) return NextResponse.json({ error: 'Pedido e arquivo são obrigatórios.' }, { status: 400 })

    const db = supabaseAdmin as any
    const { data: order, error: oe } = await db.from('orders').select('id,due_date').eq('id', orderId).eq('company_id', companyId).maybeSingle()
    if (oe) throw oe; if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

    const { data: file, error: fe } = await db.from('order_files').select('id,file_name,file_path,mime_type,file_size').eq('id', fileId).eq('order_id', orderId).maybeSingle()
    if (fe) throw fe
    if (!file || !ALLOWED_TYPES.includes(file.mime_type) || Number(file.file_size) > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Use um arquivo PDF, PNG, JPG ou WEBP de até 10 MB.' }, { status: 400 })
    }
    if (itemId) {
      const { data: item } = await db.from('order_items').select('id').eq('id', itemId).eq('order_id', orderId).maybeSingle()
      if (!item) return NextResponse.json({ error: 'Item não encontrado neste pedido.' }, { status: 400 })
    }

    let { data: link, error: le } = await db.from('order_art_approval_links')
      .select('id').eq('company_id', companyId).eq('order_id', orderId)
      .is('revoked_at', null).neq('status', 'cancelada')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (le) throw le
    if (!link) {
      const { token, tokenHash } = createApprovalToken()
      const { data: created, error: ie } = await db.from('order_art_approval_links').insert({
        company_id: companyId, order_id: orderId, token_hash: tokenHash, token_ciphertext: encryptApprovalToken(token),
        status: 'aguardando_aprovacao', current_version: 1, deadline: order.due_date, created_by: user.id,
      }).select('id').single()
      if (ie) throw ie
      link = created
    }

    const { count } = await db.from('order_art_approval_artworks').select('id', { count: 'exact', head: true }).eq('link_id', link.id)
    const position = count ?? 0

    const { data: artwork, error: ae } = await db.from('order_art_approval_artworks').insert({
      link_id: link.id, order_item_id: itemId, label, position, current_version: 1, status: 'aguardando_aprovacao',
    }).select('id').single()
    if (ae) throw ae

    const { data: blob, error: de } = await supabaseAdmin.storage.from('order-files').download(file.file_path)
    if (de || !blob) throw new Error('Não foi possível preparar o arquivo privado para aprovação.')
    const path = `${companyId}/${orderId}/${artwork.id}/${randomUUID()}-${file.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: up } = await supabaseAdmin.storage.from('art-approvals').upload(path, blob, { contentType: file.mime_type || 'application/octet-stream', upsert: false })
    if (up) throw up

    const { error: ve } = await db.from('order_art_approval_versions').insert({
      link_id: link.id, artwork_id: artwork.id, version_number: 1, file_ids: [fileId], private_file_paths: [path],
      instructions_version: ART_FINISHING_INSTRUCTIONS_VERSION, instructions_text: ART_FINISHING_INSTRUCTIONS,
    })
    if (ve) throw ve

    await db.from('order_art_approval_links').update({ status: 'aguardando_aprovacao', revoked_at: null, updated_at: new Date().toISOString() }).eq('id', link.id)

    return NextResponse.json({ ok: true, artworkId: artwork.id, linkId: link.id })
  } catch (e) { console.error('[art approval artwork:create]', e); return NextResponse.json({ error: 'Não foi possível adicionar esta arte.' }, { status: 500 }) }
}
