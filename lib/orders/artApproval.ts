/**
 * Helpers de agregação da aprovação de arte do Catálogo Online — um pedido
 * pode ter vários itens, cada um com sua própria arte (order_items.*); o
 * orders.art_status é o reflexo agregado usado pelo Kanban/painel (mesmo
 * enum já existente, nunca um sistema paralelo).
 */

type AnySupabaseClient = any

/** true quando TODO item com arte do pedido já está aprovado (itens sem art_origin são ignorados). */
export async function allItemsArtApproved(supabase: AnySupabaseClient, orderId: string): Promise<boolean> {
  const { data: items } = await supabase
    .from('order_items')
    .select('art_origin, art_approval_status')
    .eq('order_id', orderId)

  const artItems = (items ?? []).filter((i: any) => i.art_origin)
  if (artItems.length === 0) return true
  return artItems.every((i: any) => i.art_approval_status === 'approved')
}

/**
 * Recalcula orders.art_status a partir do estado agregado dos itens,
 * depois de qualquer ação de arte (iniciar análise, enviar propostas,
 * registrar alteração, aprovar). Só avança para 'aprovada' quando TODOS os
 * itens com arte estão aprovados — nunca retrocede um status já mais
 * avançado por engano (ex: não reseta para 'em_analise' se já está
 * 'em_producao').
 */
export async function syncOrderArtStatusFromItems(
  supabase: AnySupabaseClient,
  orderId: string,
  itemStatus: 'in_review' | 'proposals_sent' | 'revision_requested' | 'awaiting_extra_authorization' | 'approved',
): Promise<void> {
  const { data: order } = await supabase.from('orders').select('art_status').eq('id', orderId).single()
  if (!order) return

  if (itemStatus === 'approved') {
    const allApproved = await allItemsArtApproved(supabase, orderId)
    if (allApproved) {
      await supabase.from('orders').update({ art_status: 'aprovada', updated_at: new Date().toISOString() }).eq('id', orderId)
    }
    return
  }

  const map: Record<string, string> = {
    in_review: 'em_analise',
    proposals_sent: 'propostas_enviadas',
    revision_requested: 'necessita_correcao',
    awaiting_extra_authorization: 'aguardando_autorizacao_extra',
  }
  const next = map[itemStatus]
  // Nunca sobrescreve um status já final (aprovada/em_producao) por uma
  // ação em outro item do mesmo pedido que ainda está em andamento.
  if (next && order.art_status !== 'aprovada' && order.art_status !== 'em_producao') {
    await supabase.from('orders').update({ art_status: next, updated_at: new Date().toISOString() }).eq('id', orderId)
  }
}
