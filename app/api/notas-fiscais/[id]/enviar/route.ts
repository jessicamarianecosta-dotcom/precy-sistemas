import { NextRequest, NextResponse } from 'next/server'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActiveBlingAccessToken } from '@/lib/notasFiscais/blingConnection'
import { enviarNfeNoBling, consultarNfeNoBling, SITUACAO_NFE_LABELS, BlingApiError } from '@/lib/notasFiscais/blingClient'

/**
 * POST /api/notas-fiscais/[id]/enviar
 *
 * Único ponto do módulo que de fato manda a nota pra autorização na
 * SEFAZ (POST /nfe/{id}/enviar no Bling) — só roda a partir do clique
 * explícito da usuária na tela de confirmação (components do módulo),
 * nunca automaticamente ao abrir/salvar/mudar status do pedido.
 *
 * Idempotência: se a nota já foi enviada antes (sent_at preenchido, ou
 * status já em enviando/processando/autorizada), não manda de novo —
 * só devolve o estado atual. Isso cobre o caso de um duplo clique ou de
 * um retry de rede do próprio browser.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNotasFiscaisAccess()
  if (!auth.ok) return auth.response

  const { id } = await params

  const { data: invoice, error: invoiceErr } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .select('*')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .maybeSingle()

  if (invoiceErr) return NextResponse.json({ error: invoiceErr.message }, { status: 500 })
  if (!invoice) return NextResponse.json({ error: 'Nota fiscal não encontrada' }, { status: 404 })
  if (!invoice.bling_invoice_id) return NextResponse.json({ error: 'Esta nota ainda não foi criada no Bling' }, { status: 400 })

  if (invoice.sent_at || ['enviando', 'processando', 'autorizada'].includes(invoice.status)) {
    return NextResponse.json({ invoice, alreadySent: true })
  }

  const accessToken = await getActiveBlingAccessToken(auth.companyId)
  if (!accessToken) return NextResponse.json({ error: 'Conexão com o Bling perdida — reconecte antes de enviar.' }, { status: 400 })

  // Marca "enviando" ANTES de chamar o Bling: se o processo cair entre a
  // chamada e a resposta, a nota fica visivelmente "enviando" (nunca
  // volta sozinha pra "rascunho", o que poderia parecer convite a tentar
  // de novo e gerar uma segunda nota pro mesmo pedido).
  await (supabaseAdmin.from('fiscal_invoices') as any)
    .update({ status: 'enviando', sent_at: new Date().toISOString() })
    .eq('id', invoice.id)

  try {
    // POST /nfe/{id}/enviar responde só { data: { xml } } (confirmado na doc oficial)
    // — não tem `situacao`. A consulta GET /nfe/{id} em seguida é o que confirma se
    // o envio deu entrada (3 Aguardando recibo / 8 Aguardando protocolo) ou já voltou
    // autorizada/rejeitada/denegada da SEFAZ.
    const response = await enviarNfeNoBling(accessToken, invoice.bling_invoice_id)

    let situacaoResponse: unknown = response
    let situacaoCodigo: number | null = null
    try {
      situacaoResponse = await consultarNfeNoBling(accessToken, invoice.bling_invoice_id)
      situacaoCodigo = (situacaoResponse as any)?.data?.situacao ?? null
    } catch {
      // Envio já foi aceito pelo Bling (chamada anterior não lançou) — só a consulta
      // de confirmação falhou; status interno fica "processando" até a próxima consulta manual.
    }

    const { data: updated, error: updateErr } = await (supabaseAdmin.from('fiscal_invoices') as any)
      .update({
        status: 'processando',
        bling_status: situacaoCodigo != null ? `${situacaoCodigo} (${SITUACAO_NFE_LABELS[situacaoCodigo] ?? 'desconhecido'})` : null,
        access_key: (situacaoResponse as any)?.data?.chaveAcesso ?? null,
        last_response: { enviar: response, consultar: situacaoResponse },
        error_message: null,
      })
      .eq('id', invoice.id)
      .select('*')
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ invoice: updated })
  } catch (err) {
    const message = err instanceof BlingApiError
      ? `Bling recusou o envio da nota (${err.status}): ${JSON.stringify(err.body)}`
      : err instanceof Error ? err.message : 'Falha desconhecida ao enviar a nota ao Bling'

    await (supabaseAdmin.from('fiscal_invoices') as any)
      .update({ status: 'erro', error_message: message })
      .eq('id', invoice.id)

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
