import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCompanyIdForUser } from '@/lib/supabase/pgHelpers'
import { hasDigitalArtApprovalBeta, decryptApprovalToken } from '@/lib/orders/digitalArtApproval'

async function owner() {
  const auth = createServerComponentClient({ cookies })
  const { data: { user } } = await auth.auth.getUser()
  if (!user || !hasDigitalArtApprovalBeta(user.email)) return { user: null, companyId: null }
  return { user, companyId: await resolveCompanyIdForUser(user.id) }
}

/**
 * Histórico agrupado por arte: cada arte mostra todas as suas versões e,
 * quando houver, a resposta do cliente para cada uma — aprovar a arte 1
 * nunca aparece misturado com o histórico da arte 2.
 */
export async function GET(req: Request, ctx: { params: Promise<{ linkId: string }> }) {
  try {
    const { user, companyId } = await owner()
    if (!user || !companyId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    const { linkId } = await ctx.params; const db = supabaseAdmin as any
    const { data: link, error } = await db.from('order_art_approval_links').select('id,status,created_at,deadline,public_notes,revoked_at,cancelled_at,token_ciphertext').eq('id', linkId).eq('company_id', companyId).maybeSingle()
    if (error) throw error
    if (!link) return NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 })

    const { data: artworks, error: ae } = await db.from('order_art_approval_artworks').select('id,label,order_item_id,status,current_version,order_items(name)').eq('link_id', linkId).order('position', { ascending: true })
    if (ae) throw ae
    const artworkIds = (artworks ?? []).map((a: any) => a.id)

    const { data: versions, error: ve } = artworkIds.length
      ? await db.from('order_art_approval_versions').select('id,artwork_id,version_number,status,created_at,instructions_version,public_notes').in('artwork_id', artworkIds).order('version_number', { ascending: false })
      : { data: [], error: null }
    if (ve) throw ve
    const versionIds = (versions ?? []).map((v: any) => v.id)
    const { data: responses, error: re } = versionIds.length
      ? await db.from('order_art_approval_responses').select('id,version_id,response,customer_name,customer_note,consented_at,created_at,attachment_paths').in('version_id', versionIds)
      : { data: [], error: null }
    if (re) throw re
    const { data: notifications, error: ne } = await db.from('order_art_approval_notifications').select('id,title,message,notification_type,artwork_id,read_at,created_at').eq('link_id', linkId).order('created_at', { ascending: false })
    if (ne) throw ne

    const artworkHistory = []
    for (const a of artworks ?? []) {
      const history = []
      for (const v of (versions ?? []).filter((v: any) => v.artwork_id === a.id)) {
        const response = (responses ?? []).find((r: any) => r.version_id === v.id) ?? null
        const attachments: { url: string; name: string }[] = []
        for (const path of response?.attachment_paths ?? []) {
          const { data: signed } = await supabaseAdmin.storage.from('art-approvals').createSignedUrl(path, 3600)
          if (signed?.signedUrl) attachments.push({ url: signed.signedUrl, name: path.split('/').pop() ?? 'anexo' })
        }
        history.push({ ...v, response: response ? { ...response, attachments } : null })
      }
      artworkHistory.push({ id: a.id, label: a.label, itemName: a.order_items?.name ?? null, status: a.status, currentVersion: a.current_version, history })
    }

    return NextResponse.json({
      link: { ...link, publicUrl: link.token_ciphertext ? new URL(`/aprovar-arte/${decryptApprovalToken(link.token_ciphertext)}`, req.url).toString() : null },
      notifications: notifications ?? [],
      artworks: artworkHistory,
    })
  } catch (e) { console.error('[art approval history]', e); return NextResponse.json({ error: 'Não foi possível carregar o histórico.' }, { status: 500 }) }
}

/** Único action que sobrou neste nível: cancelar o link inteiro (todas as artes). */
export async function POST(req: Request, ctx: { params: Promise<{ linkId: string }> }) {
  try {
    const { user, companyId } = await owner()
    if (!user || !companyId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    const { linkId } = await ctx.params; const body = await req.json(); const db = supabaseAdmin as any
    const { data: link, error } = await db.from('order_art_approval_links').select('*').eq('id', linkId).eq('company_id', companyId).maybeSingle()
    if (error) throw error
    if (!link) return NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 })
    if (body.action !== 'cancel') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    if (link.status === 'aprovada') return NextResponse.json({ error: 'Uma aprovação concluída não pode ser cancelada.' }, { status: 409 })
    const { error: ue } = await db.from('order_art_approval_links').update({ status: 'cancelada', revoked_at: new Date().toISOString(), cancelled_at: new Date().toISOString(), cancelled_by: user.id, updated_at: new Date().toISOString() }).eq('id', linkId)
    if (ue) throw ue
    await db.from('order_art_events').insert({ order_id: link.order_id, company_id: companyId, created_by: user.id, event_type: 'aprovacao_digital_cancelada', description: 'Link de aprovação digital cancelado pela equipe.' })
    return NextResponse.json({ ok: true, status: 'cancelada' })
  } catch (e) { console.error('[art approval action]', e); return NextResponse.json({ error: 'Não foi possível executar a ação.' }, { status: 500 }) }
}
