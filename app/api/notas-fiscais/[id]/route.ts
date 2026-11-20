import { NextRequest, NextResponse } from 'next/server'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActiveBlingAccessToken } from '@/lib/notasFiscais/blingConnection'
import { consultarNfeNoBling, SITUACAO_NFE_LABELS, BlingApiError } from '@/lib/notasFiscais/blingClient'

/**
 * GET /api/notas-fiscais/[id]
 *
 * Consulta o estado atual da nota — se já foi enviada e ainda não está
 * num estado final, busca de novo no Bling (GET /nfe/{id}) e atualiza o
 * nosso registro: status/situação, número, chave de acesso. NÃO existe
 * "link do DANFE/XML" em nenhuma resposta do Bling (confirmado na doc
 * oficial) — o documento só sai de um endpoint à parte, GET
 * /nfe/documento/{chaveAcesso} (ver obterDocumentoNfe em blingClient.ts),
 * como base64+GZIP, não uma URL; `danfe_url`/`xml_url` continuam sem uso
 * aqui até esse fluxo de download ser implementado (fora do escopo desta
 * validação — ver README).
 *
 * Sem webhook confirmado do lado do Bling nesta versão: o "tempo real"
 * do status é por esse polling manual (clique de atualizar na tela),
 * não automático.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNotasFiscaisAccess()
  if (!auth.ok) return auth.response

  const { id } = await params

  const { data: invoice, error } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .select('*')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!invoice) return NextResponse.json({ error: 'Nota fiscal não encontrada' }, { status: 404 })

  const isFinalState = ['autorizada', 'rejeitada', 'cancelada'].includes(invoice.status)
  if (!invoice.bling_invoice_id || isFinalState) {
    return NextResponse.json({ invoice })
  }

  const accessToken = await getActiveBlingAccessToken(auth.companyId)
  if (!accessToken) return NextResponse.json({ invoice })

  try {
    const response = await consultarNfeNoBling(accessToken, invoice.bling_invoice_id)
    const data = (response as any)?.data ?? response

    const situacaoCodigo: number | null = typeof data?.situacao === 'number' ? data.situacao : null
    const internalStatus = mapBlingSituacaoToInternalStatus(situacaoCodigo, invoice.status)

    const { data: updated, error: updateErr } = await (supabaseAdmin.from('fiscal_invoices') as any)
      .update({
        status: internalStatus,
        bling_status: situacaoCodigo != null ? `${situacaoCodigo} (${SITUACAO_NFE_LABELS[situacaoCodigo] ?? 'desconhecido'})` : invoice.bling_status,
        bling_number: data?.numero != null ? String(data.numero) : invoice.bling_number,
        bling_series: data?.serie != null ? String(data.serie) : invoice.bling_series,
        access_key: data?.chaveAcesso ?? invoice.access_key,
        last_response: response,
      })
      .eq('id', invoice.id)
      .select('*')
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ invoice: updated })
  } catch (err) {
    // Falha ao consultar não é falha da nota — devolve o que já temos
    // salvo, sem sobrescrever o status local com um erro de rede.
    const message = err instanceof BlingApiError
      ? `Bling recusou a consulta (${err.status})`
      : 'Falha ao consultar o status no Bling'
    console.error('[notas-fiscais/[id]] falha ao consultar status:', message)
    return NextResponse.json({ invoice, warning: message })
  }
}

/**
 * Tradução do código de `situacao` (confirmado na doc oficial — ver
 * SITUACAO_NFE_LABELS em blingClient.ts) pro nosso status interno.
 * Código não mapeado explicitamente mantém o status atual (nunca
 * regride pra 'rascunho' sozinho) — o código CRU + rótulo continuam
 * sempre visíveis em bling_status, pra usuária nunca ficar sem saber o
 * que o Bling disse de verdade.
 */
function mapBlingSituacaoToInternalStatus(situacao: number | null, currentStatus: string): string {
  switch (situacao) {
    case 5: // Autorizada
    case 6: // Emitida DANFE
    case 7: // Registrada
      return 'autorizada'
    case 4: // Rejeitada
    case 9: // Denegada
      return 'rejeitada'
    case 2: // Cancelada
      return 'cancelada'
    case 1: // Pendente
    case 3: // Aguardando recibo
    case 8: // Aguardando protocolo
    case 10: // Consulta situação
    case 11: // Bloqueada
      return 'processando'
    default:
      return currentStatus
  }
}
