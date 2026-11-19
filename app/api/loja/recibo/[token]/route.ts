import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * GET /api/loja/recibo/[token]
 * Rota pública — abre o recibo de um recebimento já registrado
 * (payment_history.public_token), mesmo padrão de /api/loja/orcamento
 * e /api/loja/cobranca: service role, nunca RLS anônima.
 *
 * Um recibo é só a confirmação de um recebimento que JÁ aconteceu
 * (payment_history já existe antes de o recibo poder ser aberto) —
 * esta rota nunca grava nem altera nenhum valor financeiro, só lê.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = String((await params).token ?? '')
  if (!token) return NextResponse.json({ error: 'Recibo não encontrado' }, { status: 404 })

  if (!checkRateLimit(`loja-recibo-ver:${getClientIp(request)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const db = supabaseAdmin as any

  const { data: payment, error } = await db
    .from('payment_history')
    .select(`
      id, amount, payment_date, payment_method, observation, created_at, order_id,
      orders(order_number, service_name, total, company_id, customer_id),
      customers(name, cpf_cnpj)
    `)
    .eq('public_token', token)
    .maybeSingle()

  if (error || !payment || !payment.orders) {
    return NextResponse.json({ error: 'Recibo não encontrado' }, { status: 404 })
  }

  const { data: company } = await db
    .from('companies')
    .select('name, email, phone, cnpj, logo_url, primary_color, secondary_color')
    .eq('id', payment.orders.company_id)
    .maybeSingle()

  const { data: paymentsRaw } = await db
    .from('payment_history')
    .select('amount')
    .eq('order_id', payment.order_id)
  const received = (paymentsRaw ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)
  const balance = Math.max(0, Math.round((Number(payment.orders.total) - received) * 100) / 100)

  const METHOD_LABELS: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Cartão de Crédito', cartao_debito: 'Cartão de Débito',
    boleto: 'Boleto', transferencia: 'Transferência', crediario: 'Crediário', outro: 'Outro',
  }

  return NextResponse.json({
    receipt: {
      amount: Number(payment.amount),
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      payment_method_label: METHOD_LABELS[payment.payment_method] ?? payment.payment_method ?? '—',
      observation: payment.observation,
      issued_at: payment.created_at,
    },
    order: {
      order_number: payment.orders.order_number,
      service_name: payment.orders.service_name,
      total: Number(payment.orders.total),
      balance_after: balance,
    },
    customer: {
      name: payment.customers?.name ?? null,
      cpf_cnpj: payment.customers?.cpf_cnpj ?? null,
    },
    company: {
      name: company?.name ?? '',
      email: company?.email ?? null,
      phone: company?.phone ?? null,
      cnpj: company?.cnpj ?? null,
      logo_url: company?.logo_url ?? null,
      primary_color: company?.primary_color ?? '#8B6C4F',
      secondary_color: company?.secondary_color ?? '#2C2018',
    },
  })
}
