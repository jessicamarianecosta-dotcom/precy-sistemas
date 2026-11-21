import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { isIP } from 'net'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ART_APPROVAL_CONSENT_TEXT, ART_FINISHING_INSTRUCTIONS, ART_FINISHING_INSTRUCTIONS_VERSION } from '@/lib/orders/digitalArtApproval'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

async function getLink(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
  const db = supabaseAdmin as any
  const { data } = await db.from('order_art_approval_links').select('*').eq('token_hash', hash(token)).maybeSingle()
  if (!data || data.revoked_at || data.status === 'cancelada') return null
  return data
}

/**
 * Página pública: lista TODAS as artes do link, cada uma com seu status
 * independente. O nome original do arquivo nunca é devolvido aqui — só
 * o rótulo da arte e o nome do item ao qual ela pertence.
 */
export async function GET(_req: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const db = supabaseAdmin as any; const link = await getLink(token)
    if (!link) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 })
    if (link.deadline && new Date(link.deadline).getTime() < Date.now() && link.status === 'aguardando_aprovacao') {
      return NextResponse.json({ error: 'O prazo deste link expirou.' }, { status: 410 })
    }

    const [{ data: order }, { data: company }, { data: artworks }] = await Promise.all([
      db.from('orders').select('order_number,due_date,customers(name)').eq('id', link.order_id).single(),
      db.from('companies').select('name,logo_url').eq('id', link.company_id).single(),
      db.from('order_art_approval_artworks').select('id,label,position,status,current_version,order_items(name)').eq('link_id', link.id).order('position', { ascending: true }),
    ])

    const artworkIds = (artworks ?? []).map((a: any) => a.id)
    const { data: versions } = artworkIds.length
      ? await db.from('order_art_approval_versions').select('*').in('artwork_id', artworkIds)
      : { data: [] }
    const currentVersionByArtwork = new Map<string, any>()
    for (const a of artworks ?? []) {
      const v = (versions ?? []).find((v: any) => v.artwork_id === a.id && v.version_number === a.current_version)
      if (v) currentVersionByArtwork.set(a.id, v)
    }
    const versionIds = [...currentVersionByArtwork.values()].map((v: any) => v.id)
    const { data: responses } = versionIds.length
      ? await db.from('order_art_approval_responses').select('version_id,response,customer_note,created_at').in('version_id', versionIds)
      : { data: [] }

    const result = []
    let n = 0
    for (const a of artworks ?? []) {
      const version = currentVersionByArtwork.get(a.id)
      if (!version) continue
      n += 1
      const files = []
      for (const path of version.private_file_paths ?? []) {
        const { data, error } = await supabaseAdmin.storage.from('art-approvals').createSignedUrl(path, 3600)
        if (error) throw error
        files.push({ url: data.signedUrl })
      }
      const response = (responses ?? []).find((r: any) => r.version_id === version.id) ?? null
      result.push({
        id: a.id,
        number: n,
        label: a.label || `Arte ${String(n).padStart(2, '0')}`,
        itemName: a.order_items?.name ?? null,
        status: a.status,
        version: a.current_version,
        files,
        response,
      })
    }

    const summary = {
      total: result.length,
      aprovadas: result.filter(a => a.status === 'aprovada').length,
      aguardando: result.filter(a => a.status === 'aguardando_aprovacao').length,
      alteracaoSolicitada: result.filter(a => a.status === 'alteracao_solicitada').length,
    }

    return NextResponse.json({
      company: { name: company?.name, logoUrl: company?.logo_url },
      order: { number: order?.order_number, deadline: link.deadline ?? order?.due_date },
      customer: { name: order?.customers?.name },
      notes: link.public_notes,
      status: link.status,
      summary,
      artworks: result,
      instructions: ART_FINISHING_INSTRUCTIONS,
      instructionsVersion: ART_FINISHING_INSTRUCTIONS_VERSION,
      consentText: ART_APPROVAL_CONSENT_TEXT,
    })
  } catch (e) { console.error('[public art approval:get]', e); return NextResponse.json({ error: 'Falha ao carregar aprovação.' }, { status: 500 }) }
}

export async function POST(req: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const link = await getLink(token)
    if (!link) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 })
    if (link.status === 'cancelada') return NextResponse.json({ error: 'Esta aprovação foi encerrada.' }, { status: 409 })
    if (link.deadline && new Date(link.deadline).getTime() < Date.now()) return NextResponse.json({ error: 'O prazo deste link expirou.' }, { status: 410 })
    const body = await req.json()
    const artworkId = String(body.artworkId ?? '')
    const action = body.action
    const note = String(body.note ?? '').trim().slice(0, 3000)
    if (!artworkId) return NextResponse.json({ error: 'Arte não informada.' }, { status: 400 })
    if (body.consent !== true) return NextResponse.json({ error: 'É necessário confirmar a leitura das orientações.' }, { status: 400 })
    if (!['approve', 'request_changes'].includes(action)) return NextResponse.json({ error: 'Resposta inválida.' }, { status: 400 })
    if (action === 'request_changes' && !note) return NextResponse.json({ error: 'Descreva a alteração desejada.' }, { status: 400 })

    const db = supabaseAdmin as any
    const { data: artwork } = await db.from('order_art_approval_artworks').select('id').eq('id', artworkId).eq('link_id', link.id).maybeSingle()
    if (!artwork) return NextResponse.json({ error: 'Arte não encontrada neste link.' }, { status: 404 })

    const response = action === 'approve' ? 'aprovada' : 'alteracao_solicitada'
    const attachments = Array.isArray(body.attachmentPaths)
      ? body.attachmentPaths.filter((p: unknown) => typeof p === 'string' && p.startsWith(`${link.company_id}/${link.order_id}/${artworkId}/customer/`))
      : []
    if (action === 'request_changes' && attachments.length !== (body.attachmentPaths ?? []).length) return NextResponse.json({ error: 'Anexo inválido.' }, { status: 400 })
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const ipAddress = isIP(forwarded) ? forwarded : null

    const { data: rpcRows, error } = await db.rpc('register_art_approval_response_v2', {
      p_link_id: link.id, p_artwork_id: artworkId, p_response: response,
      p_customer_name: String(body.customerName ?? '').trim().slice(0, 160) || null,
      p_customer_note: note || null, p_consent_text: ART_APPROVAL_CONSENT_TEXT,
      p_ip_address: ipAddress, p_user_agent: req.headers.get('user-agent'), p_attachment_paths: attachments,
    })
    if (error) {
      if (error.message?.includes('already_responded')) return NextResponse.json({ error: 'Esta arte já recebeu uma resposta.' }, { status: 409 })
      if (error.message?.includes('not_found')) return NextResponse.json({ error: 'Arte ou link indisponível.' }, { status: 404 })
      throw error
    }
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    return NextResponse.json({ ok: true, artworkStatus: row?.artwork_status ?? response, linkStatus: row?.link_status })
  } catch (e) { console.error('[public art approval:post]', e); return NextResponse.json({ error: 'Não foi possível registrar sua resposta.' }, { status: 500 }) }
}
