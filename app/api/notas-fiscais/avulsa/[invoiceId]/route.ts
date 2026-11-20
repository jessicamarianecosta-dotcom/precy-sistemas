import { NextRequest, NextResponse } from 'next/server'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/notas-fiscais/avulsa/[invoiceId]
 *
 * Dados de revisão/acompanhamento de uma nota avulsa já criada — só leitura
 * do nosso banco, nenhuma chamada ao Bling aqui (isso é
 * /api/notas-fiscais/[id] para consultar status e
 * /api/notas-fiscais/[id]/enviar para confirmar o envio, ambos reusados
 * sem alteração pela tela de revisão da nota avulsa).
 *
 * Os itens são reconstruídos a partir de `request_payload.itens` — o
 * payload exatamente enviado ao Bling na criação — em vez de uma tabela
 * própria, já que a nota avulsa não tem order_items para referenciar.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  const auth = await requireNotasFiscaisAccess()
  if (!auth.ok) return auth.response

  const { invoiceId } = await params

  const { data: invoice, error } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .select('*, customer:customers(id, name, cpf_cnpj)')
    .eq('id', invoiceId)
    .eq('company_id', auth.companyId)
    .eq('origin', 'avulsa')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!invoice) return NextResponse.json({ error: 'Nota fiscal avulsa não encontrada' }, { status: 404 })

  const payloadItens: any[] = Array.isArray(invoice.request_payload?.itens) ? invoice.request_payload.itens : []
  const items = payloadItens.map((item, idx) => ({
    id: `${invoice.id}-${idx}`,
    name: item.descricao ?? null,
    quantity: Number(item.quantidade) || 0,
    unit_price: Number(item.valor) || 0,
    unit: item.unidade ?? null,
    code: item.codigo ?? null,
    product_ncm: item.classificacaoFiscal ?? null,
  }))

  return NextResponse.json({
    invoice,
    customer: invoice.customer,
    items,
    numero: invoice.avulsa_numero,
    total: invoice.total,
  })
}
