import { NextRequest, NextResponse } from 'next/server'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActiveBlingAccessToken } from '@/lib/notasFiscais/blingConnection'
import { criarNfeNoBling, consultarNfeNoBling, buscarNaturezasOperacao, SITUACAO_NFE_LABELS, BlingApiError } from '@/lib/notasFiscais/blingClient'
import { buildNfePayload, getMissingFields } from '@/lib/notasFiscais/fieldMapping'

/**
 * `naturezaOperacao` da NF-e é `{ id }`, referenciando um registro já
 * cadastrado na conta Bling (GET /naturezas-operacoes) — a API não aceita
 * texto livre nem cria uma nova (ver lib/notasFiscais/fieldMapping.ts).
 * A usuária digita a descrição na tela de revisão (ex.: "Venda de
 * mercadoria"); aqui resolvemos pelo match exato (case-insensitive) de
 * descrição entre as naturezas ativas da conta. Sem match: erro claro
 * pedindo pra cadastrar essa natureza de operação no Bling primeiro —
 * nunca inventamos um id.
 */
async function resolveNaturezaOperacaoId(accessToken: string, descricao: string): Promise<number> {
  const response: any = await buscarNaturezasOperacao(accessToken, descricao)
  const candidates: any[] = response?.data ?? []
  const exact = candidates.find(n => String(n?.descricao ?? '').trim().toLowerCase() === descricao.trim().toLowerCase())
  const match = exact ?? candidates[0]
  if (!match?.id) {
    throw new Error(
      `Nenhuma natureza de operação chamada "${descricao}" foi encontrada na conta Bling conectada. ` +
      `Cadastre-a em Bling → Cadastros → Naturezas de Operação antes de criar a nota.`
    )
  }
  return Number(match.id)
}

/**
 * POST /api/notas-fiscais/pedido/[orderId]/criar
 *
 * Cria a NF-e como RASCUNHO no Bling (POST /nfe) — nunca envia à SEFAZ
 * aqui (isso é [id]/enviar, numa tela separada, só com clique explícito).
 *
 * Prevenção de duplicidade em duas camadas:
 *  1. Índice único parcial em fiscal_invoices (order_id) WHERE status NOT
 *     IN ('cancelada','erro') — o banco recusa uma segunda linha "viva".
 *  2. Antes de tentar de novo, se já existe uma linha viva para este
 *     pedido: se ela já tem bling_invoice_id, devolve a existente sem
 *     chamar o Bling outra vez (evita nota duplicada em caso de timeout
 *     de uma tentativa anterior); se não tem (a tentativa anterior
 *     falhou antes do Bling responder), reusa a MESMA linha pra tentar
 *     de novo, em vez de inserir outra.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireNotasFiscaisAccess()
  if (!auth.ok) return auth.response

  const { orderId } = await params
  const body = await req.json().catch(() => ({}))
  const naturezaOperacao: string = body?.naturezaOperacao || 'Venda de mercadoria'

  const { data: order, error: orderErr } = await (supabaseAdmin.from('orders') as any)
    .select('id, order_number, customer_id, customer:customers(*)')
    .eq('id', orderId)
    .eq('company_id', auth.companyId)
    .maybeSingle()
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  const { data: items } = await (supabaseAdmin.from('order_items') as any)
    .select('id, name, quantity, unit_price, product:products(id, unit, ncm), variant:product_variants(sku)')
    .eq('order_id', order.id)

  const mappedItems = (items ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit: item.product?.unit ?? null,
    // `codigo` é obrigatório na NF-e (NotasFiscaisItemDTO) — usa o SKU da
    // variação do pedido quando existe, senão cai pro id do produto (o
    // cadastro de produto do Precy+ não tem um campo de SKU próprio).
    code: item.variant?.sku || item.product?.id || item.id,
    product_ncm: item.product?.ncm ?? null,
  }))

  const missingFields = getMissingFields(order.customer, mappedItems)
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

  // Já existe uma nota deste pedido que CHEGOU a ser criada no Bling
  // (tem bling_invoice_id)? Então o lado do Bling já existe de verdade —
  // nunca cria outra, mesmo que essa linha tenha terminado em 'erro'
  // depois (ex.: a chamada de /enviar falhou por rede DEPOIS do Bling já
  // ter aceitado a criação). Checa por TODAS as linhas do pedido, não só
  // as "vivas" — é esse detalhe que evita nota duplicada em retry.
  const { data: anyWithBlingId } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .select('*')
    .eq('order_id', order.id)
    .eq('company_id', auth.companyId)
    .not('bling_invoice_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (anyWithBlingId) {
    return NextResponse.json({ invoice: anyWithBlingId, reused: true })
  }

  // Nenhuma chegou a ser criada no Bling ainda — pode reusar a linha de
  // uma tentativa anterior que falhou antes disso (status 'erro' sem
  // bling_invoice_id), em vez de inserir outra.
  const { data: existing } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .select('*')
    .eq('order_id', order.id)
    .eq('company_id', auth.companyId)
    .not('status', 'in', '(cancelada,erro)')
    .maybeSingle()

  const payload = buildNfePayload({
    customer: order.customer,
    items: mappedItems,
    naturezaOperacaoId,
    orderNumber: order.order_number,
  })

  const invoiceId: string = existing?.id ?? (await (supabaseAdmin.from('fiscal_invoices') as any)
    .insert([{
      company_id: auth.companyId,
      order_id: order.id,
      customer_id: order.customer_id,
      status: 'rascunho',
      natureza_operacao: naturezaOperacao,
      request_payload: payload,
      created_by: auth.userId,
    }])
    .select('id')
    .single()).data?.id

  if (!invoiceId) {
    return NextResponse.json({ error: 'Falha ao preparar a nota fiscal' }, { status: 500 })
  }

  try {
    const response = await criarNfeNoBling(accessToken, payload)
    const blingInvoiceId = (response as any)?.data?.id ?? null

    // POST /nfe não devolve `situacao` (confirmado na doc oficial — só id/numero/serie/contato) —
    // uma consulta GET /nfe/{id} em seguida é o que de fato confirma o estado da nota recém-criada.
    let situacaoResponse: unknown = response
    let situacaoCodigo: number | null = null
    if (blingInvoiceId) {
      try {
        situacaoResponse = await consultarNfeNoBling(accessToken, String(blingInvoiceId))
        situacaoCodigo = (situacaoResponse as any)?.data?.situacao ?? null
      } catch {
        // Consulta falhou (ex.: rede) mas a nota já existe no Bling — não é erro fatal,
        // só fica sem o status confirmado agora; `bling_status` guarda o que sabemos.
      }
    }

    const { data: updated, error: updateErr } = await (supabaseAdmin.from('fiscal_invoices') as any)
      .update({
        status: 'rascunho',
        bling_invoice_id: blingInvoiceId ? String(blingInvoiceId) : null,
        bling_status: situacaoCodigo != null ? `${situacaoCodigo} (${SITUACAO_NFE_LABELS[situacaoCodigo] ?? 'desconhecido'})` : null,
        last_response: { criar: response, consultar: situacaoResponse },
        request_payload: payload,
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
