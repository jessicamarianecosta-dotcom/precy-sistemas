import { NextRequest, NextResponse } from 'next/server'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActiveBlingAccessToken } from '@/lib/notasFiscais/blingConnection'
import { criarNfeNoBling, consultarNfeNoBling, SITUACAO_NFE_LABELS, BlingApiError } from '@/lib/notasFiscais/blingClient'
import { buildNfePayload, getMissingFields, type OrderItemFiscalData } from '@/lib/notasFiscais/fieldMapping'
import { resolveNaturezaOperacaoId } from '@/lib/notasFiscais/naturezaOperacao'

interface AvulsaItemInput {
  description: string
  code?: string | null
  unit?: string | null
  quantity: number
  unitPrice: number
  ncm?: string | null
}

/**
 * POST /api/notas-fiscais/avulsa
 *
 * Cria uma NF-e como RASCUNHO no Bling (POST /nfe) para uma nota SEM
 * pedido vinculado do Precy+ ("nota avulsa") — mesma separação
 * criação/envio do fluxo por pedido: esta rota nunca envia à SEFAZ (isso
 * continua sendo só POST /api/notas-fiscais/[id]/enviar, em tela
 * separada, com clique explícito).
 *
 * Reaproveita, sem alterar, exatamente as mesmas funções usadas pelo
 * fluxo de pedido (app/api/notas-fiscais/pedido/[orderId]/criar):
 * buildNfePayload, getMissingFields, criarNfeNoBling, consultarNfeNoBling.
 * A única diferença é de onde vêm customer/items — aqui, do corpo da
 * requisição (cliente selecionado/cadastrado e itens escolhidos na tela
 * de nota avulsa) em vez de order_items/customers de um pedido.
 *
 * `fiscal_invoices.order_id` fica NULL e `origin = 'avulsa'`
 * (migration notas_fiscais_avulsa.sql) — nenhum pedido fictício é criado.
 */
export async function POST(req: NextRequest) {
  const auth = await requireNotasFiscaisAccess()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const customerId: string | undefined = body?.customerId
  const naturezaOperacao: string = body?.naturezaOperacao || 'Venda de mercadoria'
  const itemsInput: AvulsaItemInput[] = Array.isArray(body?.items) ? body.items : []

  if (!customerId) {
    return NextResponse.json({ error: 'Selecione ou cadastre o destinatário da nota.' }, { status: 400 })
  }
  if (itemsInput.length === 0) {
    return NextResponse.json({ error: 'Adicione ao menos um item à nota.' }, { status: 400 })
  }
  for (const item of itemsInput) {
    if (!item.description?.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return NextResponse.json({ error: 'Revise os itens: descrição, quantidade e valor unitário são obrigatórios.' }, { status: 400 })
    }
  }

  const { data: customer, error: customerErr } = await (supabaseAdmin.from('customers') as any)
    .select('*')
    .eq('id', customerId)
    .eq('company_id', auth.companyId)
    .maybeSingle()
  if (customerErr) return NextResponse.json({ error: customerErr.message }, { status: 500 })
  if (!customer) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const mappedItems: OrderItemFiscalData[] = itemsInput.map((item, idx) => ({
    id: `avulso-${idx}`,
    name: item.description.trim(),
    quantity: Number(item.quantity),
    unit_price: Number(item.unitPrice),
    unit: item.unit || 'UN',
    // `codigo` é obrigatório na NF-e (NotasFiscaisItemDTO) — mesma regra do
    // fluxo de pedido: usa o código informado (SKU/id do produto escolhido),
    // senão um código sequencial próprio da nota avulsa.
    code: item.code || `AVULSO-${idx + 1}`,
    product_ncm: item.ncm ?? null,
  }))

  const missingFields = getMissingFields(customer, mappedItems)
  if (missingFields.length > 0) {
    return NextResponse.json({ error: 'Faltam campos obrigatórios antes de emitir', missingFields }, { status: 422 })
  }

  const accessToken = await getActiveBlingAccessToken(auth.companyId)
  if (!accessToken) {
    return NextResponse.json({ error: 'Conecte sua conta do Bling antes de emitir notas fiscais.' }, { status: 400 })
  }

  let naturezaOperacaoId: number
  try {
    naturezaOperacaoId = await resolveNaturezaOperacaoId(accessToken, naturezaOperacao)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Falha ao resolver a natureza de operação' }, { status: 422 })
  }

  // Número de exibição da nota avulsa (não existe order_number aqui) —
  // sequencial simples por empresa, só para exibição e para preencher o
  // campo obrigatório `numero`/`numeroPedidoLoja` da NF-e.
  const { count } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', auth.companyId)
    .eq('origin', 'avulsa')
  const avulsaNumero = `AV-${String((count ?? 0) + 1).padStart(4, '0')}`
  const total = mappedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)

  const payload = buildNfePayload({
    customer,
    items: mappedItems,
    naturezaOperacaoId,
    orderNumber: avulsaNumero,
  })

  const { data: inserted, error: insertErr } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .insert([{
      company_id: auth.companyId,
      order_id: null,
      customer_id: customerId,
      origin: 'avulsa',
      avulsa_numero: avulsaNumero,
      total,
      status: 'rascunho',
      natureza_operacao: naturezaOperacao,
      request_payload: payload,
      created_by: auth.userId,
    }])
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    return NextResponse.json({ error: insertErr?.message || 'Falha ao preparar a nota fiscal' }, { status: 500 })
  }
  const invoiceId: string = inserted.id

  try {
    const response = await criarNfeNoBling(accessToken, payload)
    const blingInvoiceId = (response as any)?.data?.id ?? null

    let situacaoResponse: unknown = response
    let situacaoCodigo: number | null = null
    if (blingInvoiceId) {
      try {
        situacaoResponse = await consultarNfeNoBling(accessToken, String(blingInvoiceId))
        situacaoCodigo = (situacaoResponse as any)?.data?.situacao ?? null
      } catch {
        // Consulta falhou (ex.: rede) mas a nota já existe no Bling — não é
        // erro fatal, só fica sem o status confirmado agora.
      }
    }

    const { data: updated, error: updateErr } = await (supabaseAdmin.from('fiscal_invoices') as any)
      .update({
        status: 'rascunho',
        bling_invoice_id: blingInvoiceId ? String(blingInvoiceId) : null,
        bling_status: situacaoCodigo != null ? `${situacaoCodigo} (${SITUACAO_NFE_LABELS[situacaoCodigo] ?? 'desconhecido'})` : null,
        last_response: { criar: response, consultar: situacaoResponse },
        error_message: null,
      })
      .eq('id', invoiceId)
      .select('*')
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ invoice: updated })
  } catch (err) {
    const message = err instanceof BlingApiError
      ? `Bling recusou a criação da nota (${err.status}): ${JSON.stringify(err.body)}`
      : err instanceof Error ? err.message : 'Falha desconhecida ao criar a nota no Bling'

    await (supabaseAdmin.from('fiscal_invoices') as any)
      .update({ status: 'erro', error_message: message })
      .eq('id', invoiceId)

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
