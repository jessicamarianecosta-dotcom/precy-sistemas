import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getShippingAdapter } from '@/lib/catalog/shipping'
import { getShippingOriginSettings, resolveShippingItems } from '@/lib/catalog/shipping/resolveCartShipping'

/**
 * POST /api/pedidos/:id/etiqueta
 * Autenticado (dashboard) — gera a etiqueta de envio do pedido no SuperFrete
 * e grava o resultado em order_shipments (1:1 com o pedido).
 *
 * Idempotência: order_shipments.order_id é UNIQUE — se já existir uma
 * etiqueta para este pedido, retorna ela em vez de gerar outra. Nunca
 * contrata um segundo envio para o mesmo pedido.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params

  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: company, error: companyErr } = await (supabaseAdmin.from('companies') as any)
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (companyErr || !company) {
    return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })
  }
  const companyId = company.id as string

  const { data: order, error: orderErr } = await (supabaseAdmin.from('orders') as any)
    .select('id, company_id, order_number, payment_status, shipping_service, total, customers(name, phone, cpf_cnpj, zip_code, street, number, complement, neighborhood, city, state)')
    .eq('id', orderId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (orderErr || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  if (order.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Só é possível gerar etiqueta para pedidos com pagamento confirmado' }, { status: 422 })
  }

  /* ── Idempotência: já existe etiqueta gerada para este pedido? ── */
  const { data: existingShipment } = await (supabaseAdmin.from('order_shipments') as any)
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()
  if (existingShipment) {
    return NextResponse.json({ shipment: existingShipment, alreadyExisted: true })
  }

  const recipient = order.customers
  if (!recipient?.name || !recipient?.phone || !recipient?.zip_code || !recipient?.street || !recipient?.number || !recipient?.city || !recipient?.state) {
    return NextResponse.json({
      error: 'Endereço do cliente incompleto para gerar a etiqueta (CEP, rua, número, cidade e estado são obrigatórios).',
    }, { status: 422 })
  }

  const origin = await getShippingOriginSettings(companyId)
  if (!origin) {
    return NextResponse.json({
      error: 'Configure o endereço de envio da sua loja em Catálogo → Configurações → Dados de Envio antes de gerar etiquetas.',
    }, { status: 422 })
  }

  const { data: orderItems } = await (supabaseAdmin.from('order_items') as any)
    .select('product_id, quantity')
    .eq('order_id', orderId)
  const shippingItems = await resolveShippingItems(
    companyId,
    (orderItems ?? []).filter((i: any) => i.product_id).map((i: any) => ({ productId: i.product_id, quantity: i.quantity })),
    origin
  )
  if (shippingItems.length === 0) {
    return NextResponse.json({ error: 'Pedido sem itens válidos para gerar etiqueta' }, { status: 422 })
  }

  const destCep = String(recipient.zip_code).replace(/\D/g, '')

  try {
    const adapter = getShippingAdapter()

    // Recotar para obter o serviceId correspondente ao serviço escolhido no
    // checkout (orders.shipping_service guarda só o nome) — a API do
    // SuperFrete exige o id numérico do serviço para contratar o envio.
    const quotes = await adapter.quote(origin.originCep, destCep, shippingItems)
    const chosen = quotes.find(q => q.service === order.shipping_service) ?? quotes[0]
    if (!chosen) {
      return NextResponse.json({ error: 'Não foi possível recotar o frete deste pedido para gerar a etiqueta' }, { status: 502 })
    }

    const result = await adapter.createShipment({
      service: chosen.service,
      serviceId: chosen.serviceId,
      orderRef: order.order_number || orderId,
      items: shippingItems,
      from: {
        name: origin.senderName,
        document: origin.senderDocument,
        phone: origin.senderPhone,
        cep: origin.originCep,
        street: origin.street,
        number: origin.number,
        complement: origin.complement,
        district: origin.district,
        city: origin.city,
        state: origin.state,
      },
      to: {
        name: recipient.name,
        phone: recipient.phone,
        document: recipient.cpf_cnpj ?? null,
        cep: destCep,
        street: recipient.street,
        number: recipient.number,
        complement: recipient.complement,
        district: recipient.neighborhood,
        city: recipient.city,
        state: recipient.state,
      },
    })

    const { data: shipment, error: insertErr } = await (supabaseAdmin.from('order_shipments') as any)
      .insert([{
        order_id: orderId,
        company_id: companyId,
        provider: 'superfrete',
        provider_shipment_id: result.providerShipmentId,
        service_name: chosen.service,
        status: result.status,
        tracking_code: result.trackingCode,
        tracking_url: result.trackingUrl,
        label_url: result.labelUrl,
        price: chosen.price,
        raw_response: result.raw,
      }])
      .select()
      .single()

    if (insertErr) {
      // Corrida rara: dois cliques quase simultâneos passaram pela checagem
      // de idempotência acima ao mesmo tempo — a UNIQUE(order_id) do banco
      // é a trava final. Devolve a etiqueta já existente em vez de erro.
      if (insertErr.code === '23505') {
        const { data: raceShipment } = await (supabaseAdmin.from('order_shipments') as any)
          .select('*').eq('order_id', orderId).maybeSingle()
        return NextResponse.json({ shipment: raceShipment, alreadyExisted: true })
      }
      return NextResponse.json({ error: `Etiqueta gerada mas falhou ao salvar: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ shipment })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao gerar etiqueta' }, { status: 502 })
  }
}

/**
 * GET /api/pedidos/:id/etiqueta — devolve a etiqueta já gerada (se houver).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params

  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: company } = await (supabaseAdmin.from('companies') as any)
    .select('id').eq('user_id', user.id).single()
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  const { data: shipment } = await (supabaseAdmin.from('order_shipments') as any)
    .select('*')
    .eq('order_id', orderId)
    .eq('company_id', company.id)
    .maybeSingle()

  return NextResponse.json({ shipment: shipment ?? null })
}
