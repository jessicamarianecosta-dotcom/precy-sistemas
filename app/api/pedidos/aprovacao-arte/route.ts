import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { createApprovalToken, encryptApprovalToken, decryptApprovalToken, hasDigitalArtApprovalBeta } from '@/lib/orders/digitalArtApproval'

/**
 * Aprovação digital de arte — modelo por PEDIDO, não por item: um único
 * link cobre quantas artes forem anexadas, e cada arte (order_art_
 * approval_artworks) tem seu próprio status. Este endpoint cuida só do
 * link (criar/ajustar observação e prazo); a lista de artes é gerida em
 * /api/pedidos/aprovacao-arte/artworks.
 */

async function loadLinkWithArtworks(db: any, orderId: string, companyId: string, requestUrl: string) {
  const { data: link, error } = await db.from('order_art_approval_links')
    .select('id,status,token_ciphertext,public_notes,deadline')
    .eq('company_id', companyId).eq('order_id', orderId)
    .is('revoked_at', null).neq('status', 'cancelada')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!link) return { link: null, artworks: [] }

  const { data: artworks, error: ae } = await db.from('order_art_approval_artworks')
    .select('id,order_item_id,label,position,current_version,status,order_items(name)')
    .eq('link_id', link.id).order('position', { ascending: true })
  if (ae) throw ae

  const versionIds = (artworks ?? []).map((a: any) => a.current_version)
  const artworkIds = (artworks ?? []).map((a: any) => a.id)
  const { data: versions } = artworkIds.length
    ? await db.from('order_art_approval_versions').select('id,artwork_id,version_number,file_ids').in('artwork_id', artworkIds)
    : { data: [] }

  const enriched = []
  for (const a of artworks ?? []) {
    const version = (versions ?? []).find((v: any) => v.artwork_id === a.id && v.version_number === a.current_version)
    const fileId = version?.file_ids?.[0] ?? null
    let fileName: string | null = null
    if (fileId) {
      const { data: file } = await db.from('order_files').select('file_name,file_url').eq('id', fileId).maybeSingle()
      fileName = file?.file_name ?? null
    }
    enriched.push({
      id: a.id, itemId: a.order_item_id, itemName: a.order_items?.name ?? null,
      label: a.label, position: a.position, status: a.status, version: a.current_version,
      fileId, fileName,
    })
  }

  return {
    link: {
      id: link.id, status: link.status, publicNotes: link.public_notes, deadline: link.deadline,
      url: link.token_ciphertext ? new URL('/aprovar-arte/' + decryptApprovalToken(link.token_ciphertext), requestUrl).toString() : null,
    },
    artworks: enriched,
  }
}

export async function GET(request: Request) {
  try {
    const auth = createServerComponentClient({ cookies }); const { data: { user } } = await auth.auth.getUser()
    if (!user || !hasDigitalArtApprovalBeta(user.email)) return NextResponse.json({ error: 'Recurso indisponível.' }, { status: 404 })
    const companyId = await resolveCompanyIdForUser(user.id); if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    const url = new URL(request.url); const orderId = url.searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 })
    const db = supabaseAdmin as any
    const result = await loadLinkWithArtworks(db, orderId, companyId, request.url)
    return NextResponse.json(result)
  } catch (e) { console.error('[art approval:get]', e); return NextResponse.json({ error: 'Não foi possível carregar a aprovação.' }, { status: 500 }) }
}

export async function POST(request: Request) {
  try {
    const auth = createServerComponentClient({ cookies }); const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasDigitalArtApprovalBeta(user.email)) return NextResponse.json({ error: 'Recurso indisponível.' }, { status: 404 })
    const companyId = await resolveCompanyIdForUser(user.id); if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    const body = await request.json(); const orderId = String(body.orderId ?? '')
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 })
    const db = supabaseAdmin as any
    const { data: order, error: oe } = await db.from('orders').select('id,order_number,due_date').eq('id', orderId).eq('company_id', companyId).maybeSingle()
    if (oe) throw oe; if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

    const publicNotes = body.publicNotes !== undefined ? (String(body.publicNotes ?? '').trim().slice(0, 2000) || null) : undefined
    const deadline = body.deadline !== undefined ? (body.deadline ? new Date(body.deadline).toISOString() : null) : undefined

    const { data: existing, error: ee } = await db.from('order_art_approval_links')
      .select('id').eq('company_id', companyId).eq('order_id', orderId)
      .is('revoked_at', null).neq('status', 'cancelada')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (ee) throw ee

    if (existing) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (publicNotes !== undefined) patch.public_notes = publicNotes
      if (deadline !== undefined) patch.deadline = deadline
      const { error: ue } = await db.from('order_art_approval_links').update(patch).eq('id', existing.id)
      if (ue) throw ue
    } else {
      const { token, tokenHash } = createApprovalToken()
      const { error: ie } = await db.from('order_art_approval_links').insert({
        company_id: companyId, order_id: orderId, token_hash: tokenHash, token_ciphertext: encryptApprovalToken(token),
        status: 'aguardando_aprovacao', current_version: 1,
        public_notes: publicNotes ?? null, deadline: deadline ?? order.due_date, created_by: user.id,
      })
      if (ie) throw ie
    }

    const result = await loadLinkWithArtworks(db, orderId, companyId, request.url)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) { console.error('[art approval:upsert]', e); return NextResponse.json({ error: 'Não foi possível salvar a configuração do link.' }, { status: 500 }) }
}
