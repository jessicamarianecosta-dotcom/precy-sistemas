import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/loja/pedido/[ref]
 * Rota pública de acompanhamento de pedido — [ref] é o
 * `catalog_checkout_ref` (UUID gerado no checkout, nunca exposto em listas
 * públicas), funcionando como token de acesso: só quem tem o link recebido
 * após a compra consegue ver o pedido. Devolve só os campos necessários
 * para o cliente acompanhar — nunca dados de outros pedidos/clientes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const ref = String((await params).ref ?? '')
  if (!ref) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  const { data: order, error } = await (supabaseAdmin.from('orders') as any)
    .select(`
      id, order_number, status, payment_status, subtotal, delivery_fee, total,
      shipping_service, shipping_days, tracking_code, created_at, source,
      delivery_city, delivery_state
    `)
    .eq('catalog_checkout_ref', ref)
    .eq('source', 'catalog')
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  const { data: items } = await (supabaseAdmin.from('order_items') as any)
    .select('name, variant_label, quantity, unit_price, subtotal, variant_photo')
    .eq('order_id', order.id)

  // Pix só continua útil de mostrar enquanto o pagamento não foi decidido —
  // depois de pago/recusado/expirado o QR Code não serve para nada.
  let payment: { method: string | null; qrCode: string | null; qrCodeBase64: string | null; expiresAt: string | null; installments: number | null } | null = null
  if (order.payment_status === 'pending' || order.payment_status === 'partial') {
    const { data: paymentRow } = await (supabaseAdmin.from('payments') as any)
      .select('payment_method, pix_qr_code, pix_qr_code_base64, pix_expires_at, installments')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (paymentRow) {
      payment = {
        method: paymentRow.payment_method,
        qrCode: paymentRow.pix_qr_code,
        qrCodeBase64: paymentRow.pix_qr_code_base64,
        expiresAt: paymentRow.pix_expires_at,
        installments: paymentRow.installments,
      }
    }
  }

  return NextResponse.json({ order, items: items ?? [], payment })
}
