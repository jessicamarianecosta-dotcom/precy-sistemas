import { NextResponse } from 'next/server'
import { z } from 'zod'
import { precyflowAdmin as supabaseAdmin } from '@/lib/precyflow/admin'

/* Checkout público da vitrine do PrecyFlow — sem sessão (comprador não
   tem conta). Roda inteiramente com service role: a RLS de
   precyflow_customers/orders só permite escrita para o dono da loja, então
   qualquer insert do visitante tem que passar por aqui, nunca pelo client
   anônimo direto. Nenhum pagamento é processado — não há provedor
   configurado para o PrecyFlow; o pedido fica "a_confirmar" para a loja
   entrar em contato, como o guia pede ("não simular cobranças reais"). */

const itemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1),
})

const checkoutSchema = z.object({
  store_id: z.string().uuid(),
  customer_name: z.string().min(1),
  customer_phone: z.string().min(1),
  customer_email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
})

export async function POST(req: Request) {
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }
  const data = parsed.data

  const { data: store } = await supabaseAdmin
    .from('precyflow_stores')
    .select('id, published')
    .eq('id', data.store_id)
    .eq('published', true)
    .maybeSingle()

  if (!store) {
    return NextResponse.json({ error: 'Loja não encontrada ou indisponível.' }, { status: 404 })
  }

  const { data: products } = await supabaseAdmin
    .from('precyflow_products')
    .select('id, name, price, store_id, is_active, show_in_storefront')
    .in('id', data.items.map(i => i.product_id))

  const productMap = new Map((products ?? []).map(p => [p.id, p]))
  for (const item of data.items) {
    const product = productMap.get(item.product_id)
    if (!product || product.store_id !== data.store_id || !product.is_active || !product.show_in_storefront) {
      return NextResponse.json({ error: 'Um dos itens do carrinho não está mais disponível.' }, { status: 400 })
    }
  }

  let customerId: string
  const { data: existingCustomer } = await supabaseAdmin
    .from('precyflow_customers')
    .select('id')
    .eq('store_id', data.store_id)
    .eq('phone', data.customer_phone)
    .maybeSingle()

  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const { data: newCustomer, error: customerError } = await supabaseAdmin
      .from('precyflow_customers')
      .insert({ store_id: data.store_id, name: data.customer_name, phone: data.customer_phone, email: data.customer_email || null })
      .select('id')
      .single()
    if (customerError || !newCustomer) {
      return NextResponse.json({ error: 'Não foi possível registrar seus dados.' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  const total = data.items.reduce((sum, item) => sum + (productMap.get(item.product_id)!.price * item.quantity), 0)
  const noteParts = [data.address ? `Endereço: ${data.address}` : null, data.notes || null].filter(Boolean)

  const { data: order, error: orderError } = await supabaseAdmin
    .from('precyflow_orders')
    .insert({
      store_id: data.store_id,
      customer_id: customerId,
      origin: 'vitrine',
      subtotal: total,
      total,
      notes: noteParts.length ? noteParts.join(' · ') : null,
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Não foi possível criar o pedido.' }, { status: 500 })
  }

  const { error: itemsError } = await supabaseAdmin.from('precyflow_order_items').insert(
    data.items.map(item => {
      const product = productMap.get(item.product_id)!
      return {
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: product.price * item.quantity,
      }
    })
  )

  if (itemsError) {
    return NextResponse.json({ error: 'Pedido criado, mas houve erro ao salvar os itens.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order_number: order.order_number })
}
