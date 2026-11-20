import { NextRequest, NextResponse } from 'next/server'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActiveBlingAccessToken } from '@/lib/notasFiscais/blingConnection'
import { consultarNfeNoBling, BlingApiError } from '@/lib/notasFiscais/blingClient'

/**
 * GET /api/notas-fiscais/[id]
 *
 * Consulta o estado atual da nota — se já foi enviada e ainda não está
 * num estado final, busca de novo no Bling (GET /nfe/{id}) e atualiza o
 * nosso registro: status/situação, número, chave de acesso, link do
 * DANFE/XML quando a API devolver (campos ainda não confirmados contra a
 * doc oficial — ver lib/notasFiscais/README.md — por isso lidos de forma
 * defensiva, sem presumir formato).
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

    const situacao: string | null = data?.situacao ?? null
    const internalStatus = mapBlingSituacaoToInternalStatus(situacao, invoice.status)

    const { data: updated, error: updateErr } = await (supabaseAdmin.from('fiscal_invoices') as any)
      .update({
        status: internalStatus,
        bling_status: situacao,
        bling_number: data?.numero != null ? String(data.numero) : invoice.bling_number,
        bling_series: data?.serie != null ? String(data.serie) : invoice.bling_series,
        access_key: data?.chaveAcesso ?? data?.numeroAcesso ?? invoice.access_key,
        danfe_url: data?.linkDanfe ?? data?.link?.danfe ?? invoice.danfe_url,
        xml_url: data?.linkXml ?? data?.link?.xml ?? invoice.xml_url,
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
 * Tradução best-effort da situação crua do Bling pro nosso status
 * interno — o enum exato de `situacao` da v3 não foi confirmado contra a
 * doc oficial nesta sessão (ver lib/notasFiscais/README.md). Qualquer
 * valor não reconhecido mantém o status atual (nunca regride pra
 * 'rascunho' sozinho) — o valor CRU continua sempre visível em
 * bling_status, pra usuária nunca ficar sem saber o que o Bling disse de
 * verdade.
 */
function mapBlingSituacaoToInternalStatus(situacao: string | null, currentStatus: string): string {
  if (!situacao) return currentStatus
  const normalized = situacao.toLowerCase()
  if (normalized.includes('autoriz') || normalized.includes('concluíd') || normalized.includes('concluid')) return 'autorizada'
  if (normalized.includes('rejeit')) return 'rejeitada'
  if (normalized.includes('cancel')) return 'cancelada'
  if (normalized.includes('denegad')) return 'rejeitada'
  if (normalized.includes('process') || normalized.includes('autorização') || normalized.includes('autorizacao')) return 'processando'
  return currentStatus
}
