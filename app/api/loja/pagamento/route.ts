import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { getPaymentAdapterForCompany } from '@/lib/catalog/payments'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * POST /api/loja/pagamento
 * Rota pública (checkout da loja, Etapa 4) — body: { slug, checkoutRef, formData }
 *
 * Recebe o formData devolvido pelo Payment Brick (Pix ou cartão, já no
 * formato da API de Pagamentos do Mercado Pago) e cria o pagamento de fato,
 * SEMPRE usando o valor do pedido já criado no banco (nunca um valor vindo
 * do client). Devolve o status que o Mercado Pago respondeu na hora (para a
 * UI mostrar o QR Code do Pix ou "processando"/"recusado" no cartão), mas
 * quem efetivamente confirma o pedido como pago é só o webhook
 * (app/api/webhooks/mercadopago/route.ts) — esta resposta nunca grava
 * payment_status='paid' no pedido.
 */
export async function POST(request: Request) {
  if (!checkRateLimit(`loja-pagamento:${getClientIp(request)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const slug = String(body?.slug ?? '')
  const checkoutRef = String(body?.checkoutRef ?? '')
  const formData = body?.formData ?? null

  if (!slug || !checkoutRef || !formData?.payment_method_id) {
    return NextResponse.json({ error: 'Dados insuficientes para processar o pagamento' }, { status: 400 })
  }

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
  }

  const { data: order, error: orderError } = await (supabaseAdmin.from('orders') as any)
    .select('id, order_number, total, payment_status, delivery_email, customers(email, name)')
    .eq('company_id', companyId)
    .eq('catalog_checkout_ref', checkoutRef)
    .eq('source', 'catalog')
    .maybeSingle()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }
  if (order.payment_status === 'paid') {
    return NextResponse.json({ error: 'Este pedido já está pago' }, { status: 409 })
  }

  try {
    const adapter = await getPaymentAdapterForCompany(companyId)
    const result = await adapter.createDirectPayment(
      {
        ref: checkoutRef,
        // Valor sempre lido do pedido já criado — nunca do formData do Brick.
        amount: Number(order.total),
        customerName: order.customers?.name ?? '',
        customerEmail: order.delivery_email || order.customers?.email || null,
        description: `Pedido ${order.order_number} — Catálogo Online`,
      },
      {
        payment_method_id: formData.payment_method_id,
        token: formData.token,
        installments: formData.installments,
        issuer_id: formData.issuer_id,
        payer: formData.payer,
      }
    )
    return NextResponse.json({ status: result.status, statusDetail: result.statusDetail, pix: result.pix ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao processar pagamento' }, { status: 502 })
  }
}
