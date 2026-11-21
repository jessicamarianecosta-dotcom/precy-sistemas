import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { ART_FINISHING_INSTRUCTIONS, ART_FINISHING_INSTRUCTIONS_VERSION, hasDigitalArtApprovalBeta } from '@/lib/orders/digitalArtApproval'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

async function owner() {
  const auth = createServerComponentClient({ cookies })
  const { data: { user } } = await auth.auth.getUser()
  if (!user || !hasDigitalArtApprovalBeta(user.email)) return { user: null, companyId: null }
  return { user, companyId: await resolveCompanyIdForUser(user.id) }
}

/**
 * PATCH: substitui o arquivo da arte (nova versão — a anterior some do
 * histórico apenas como "substituída", nunca é apagada) e/ou atualiza
 * item vinculado e rótulo. Substituir o arquivo sempre volta esta arte
 * para "aguardando_aprovacao": uma arte já aprovada que muda de arquivo
 * precisa ser conferida de novo — mas isso nunca mexe nas outras artes.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ artworkId: string }> }) {
  try {
    const { user, companyId } = await owner()
    if (!user || !companyId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    const { artworkId } = await ctx.params
    const body = await request.json()
    const db = supabaseAdmin as any

    const { data: artwork, error: ae } = await db.from('order_art_approval_artworks')
      .select('id,link_id,current_version,order_art_approval_links!inner(id,company_id,order_id)')
      .eq('id', artworkId).eq('order_art_approval_links.company_id', companyId).maybeSingle()
    if (ae) throw ae
    if (!artwork) return NextResponse.json({ error: 'Arte não encontrada.' }, { status: 404 })
    const orderId = artwork.order_art_approval_links.order_id

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.itemId !== undefined) {
      const itemId = body.itemId ? String(body.itemId) : null
      if (itemId) {
        const { data: item } = await db.from('order_items').select('id').eq('id', itemId).eq('order_id', orderId).maybeSingle()
        if (!item) return NextResponse.json({ error: 'Item não encontrado neste pedido.' }, { status: 400 })
      }
      patch.order_item_id = itemId
    }
    if (body.label !== undefined) patch.label = body.label ? String(body.label).trim().slice(0, 120) : null

    if (body.fileId) {
      const fileId = String(body.fileId)
      const { data: file, error: fe } = await db.from('order_files').select('id,file_name,file_path,mime_type,file_size').eq('id', fileId).eq('order_id', orderId).maybeSingle()
      if (fe) throw fe
      if (!file || !ALLOWED_TYPES.includes(file.mime_type) || Number(file.file_size) > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Use um arquivo PDF, PNG, JPG ou WEBP de até 10 MB.' }, { status: 400 })
      }
      const { data: blob, error: de } = await supabaseAdmin.storage.from('order-files').download(file.file_path)
      if (de || !blob) throw new Error('Não foi possível copiar o arquivo privado.')
      const path = `${companyId}/${orderId}/${artworkId}/${randomUUID()}-${file.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: up } = await supabaseAdmin.storage.from('art-approvals').upload(path, blob, { contentType: file.mime_type || 'application/octet-stream', upsert: false })
      if (up) throw up

      const next = Number(artwork.current_version) + 1
      const { error: oldErr } = await db.from('order_art_approval_versions').update({ status: 'substituida' }).eq('artwork_id', artworkId).eq('version_number', artwork.current_version)
      if (oldErr) throw oldErr
      const { error: newErr } = await db.from('order_art_approval_versions').insert({
        link_id: artwork.link_id, artwork_id: artworkId, version_number: next, file_ids: [fileId], private_file_paths: [path], instructions_version: ART_FINISHING_INSTRUCTIONS_VERSION, instructions_text: ART_FINISHING_INSTRUCTIONS,
      })
      if (newErr) throw newErr
      patch.current_version = next
      patch.status = 'aguardando_aprovacao'
    }

    const { error: ue } = await db.from('order_art_approval_artworks').update(patch).eq('id', artworkId)
    if (ue) throw ue

    if (patch.status === 'aguardando_aprovacao') {
      await db.from('order_art_approval_links').update({ status: 'aguardando_aprovacao', updated_at: new Date().toISOString() }).eq('id', artwork.link_id)
      await db.from('order_art_events').insert({ order_id: orderId, company_id: companyId, created_by: user.id, event_type: 'aprovacao_digital_nova_versao', description: 'Nova versão enviada para aprovação de uma das artes.' })
    }

    return NextResponse.json({ ok: true })
  } catch (e) { console.error('[art approval artwork:update]', e); return NextResponse.json({ error: 'Não foi possível atualizar esta arte.' }, { status: 500 }) }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ artworkId: string }> }) {
  try {
    const { user, companyId } = await owner()
    if (!user || !companyId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    const { artworkId } = await ctx.params
    const db = supabaseAdmin as any
    const { data: artwork, error: ae } = await db.from('order_art_approval_artworks')
      .select('id,link_id,order_art_approval_links!inner(id,company_id)')
      .eq('id', artworkId).eq('order_art_approval_links.company_id', companyId).maybeSingle()
    if (ae) throw ae
    if (!artwork) return NextResponse.json({ error: 'Arte não encontrada.' }, { status: 404 })
    const { error: de } = await db.from('order_art_approval_artworks').delete().eq('id', artworkId)
    if (de) throw de
    return NextResponse.json({ ok: true })
  } catch (e) { console.error('[art approval artwork:delete]', e); return NextResponse.json({ error: 'Não foi possível remover esta arte.' }, { status: 500 }) }
}
