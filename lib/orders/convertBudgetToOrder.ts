import { randomUUID } from 'crypto'
import { extractPixSnapshot } from '@/lib/company/pix'

/**
 * Conversão de um orçamento em pedido — lógica única, reaproveitada tanto
 * pelo botão "Converter em Pedido" do painel (via app/api/orcamentos/[id]/converter)
 * quanto pela aprovação do cliente no link público
 * (app/api/loja/orcamento/[token]/aprovar). Não duplicar esta lógica em
 * nenhum outro lugar.
 *
 * `db` é qualquer client Supabase já resolvido para o escopo correto
 * (supabaseAdmin no servidor, ou o client autenticado do dashboard) — esta
 * função nunca cria client próprio nem decide autenticação/autorização;
 * quem chama já deve ter validado que `budgetId` pertence a `companyId`.
 */
export interface ConvertBudgetResult {
  ok: true
  orderId: string
  orderNumber: string
  alreadyConverted?: boolean
}
export interface ConvertBudgetError {
  ok: false
  error: string
}

export async function convertBudgetToOrder(
  db: any,
  budgetId: string,
  companyId: string,
): Promise<ConvertBudgetResult | ConvertBudgetError> {
  // Revalida no banco antes de criar (evita corrida / duplo-clique)
  const { data: b, error: budgetErr } = await db
    .from('budgets')
    .select('*, customers(name,email,phone,city,state,cpf_cnpj)')
    .eq('id', budgetId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (budgetErr || !b) {
    return { ok: false, error: 'Orçamento não encontrado' }
  }

  if (b.converted_to_order_id) {
    const { data: existingOrder } = await db
      .from('orders')
      .select('id, order_number')
      .eq('id', b.converted_to_order_id)
      .maybeSingle()
    return {
      ok: true,
      orderId: b.converted_to_order_id,
      orderNumber: existingOrder?.order_number ?? '',
      alreadyConverted: true,
    }
  }

  try {
    // 1. Itens do orçamento (com fallback de dados do produto)
    const { data: bi } = await db
      .from('budget_items')
      .select('*, products(name, description, width, height, area, measurement_unit, finishings, finishing_type, technical_notes)')
      .eq('budget_id', b.id)

    const customer = b.customers as any
    const customerId = b.customer_id

    const sigAmt = Number(b.signal_amount) || 0
    const orderTotal = Number(b.total) || 0

    const orderPayload: Record<string, unknown> = {
      company_id: companyId,
      customer_id: customerId,
      order_number: '',
      service_name: (bi ?? []).length > 0
        ? (bi![0].name || 'Pedido')
        : (customer?.name ? `Pedido — ${customer.name}` : 'Pedido'),
      description: b.notes || null,
      status: 'pending',
      payment_status: 'pending',
      payment_method: b.payment_method || null,
      subtotal: Number(b.subtotal) || 0,
      discount: Number(b.discount) || 0,
      total: orderTotal,
      signal_amount: sigAmt,
      remaining_amount: orderTotal,
      notes: b.notes || null,
      ...extractPixSnapshot(b),
      due_date: (() => {
        const n = Number(b.delivery_days)
        return Number.isFinite(n) && n > 0
          ? new Date(Date.now() + n * 86400000).toISOString()
          : null
      })(),
      priority: 'normal',
      quote_id: b.id,
    }

    let { data: order, error: orderErr } = await db
      .from('orders')
      .insert([orderPayload])
      .select('id, order_number')
      .single()

    if (orderErr && orderErr.code === 'PGRST204' && /pix_(key|type|label)/.test(orderErr.message || '')) {
      const { pix_type, pix_key, pix_label, ...payloadWithoutPix } = orderPayload as any
      ;({ data: order, error: orderErr } = await db
        .from('orders')
        .insert([payloadWithoutPix])
        .select('id, order_number')
        .single())
    }

    if (orderErr) throw new Error(orderErr.message)

    const itemRows = (bi ?? []).map((i: any) => ({
      order_id: order.id,
      product_id: i.product_id || null,
      name: i.name || i.products?.name || 'Item',
      description: i.description || i.products?.description || null,
      quantity: Number(i.quantity) || 1,
      unit_price: Number(i.unit_price) || 0,
      discount: 0,
      discount_type: 'amount',
      subtotal: Number(i.subtotal) || 0,
      width: i.width ?? i.products?.width ?? null,
      height: i.height ?? i.products?.height ?? null,
      area: i.area ?? i.products?.area ?? null,
      measurement_unit: i.measurement_unit ?? i.products?.measurement_unit ?? null,
      finishings: Array.isArray(i.finishings) ? i.finishings
        : Array.isArray(i.products?.finishings) ? i.products.finishings
        : [],
      finishing_type: i.finishing_type ?? i.products?.finishing_type ?? null,
      technical_notes: i.technical_notes ?? i.products?.technical_notes ?? null,
      ...(i.variant_id ? { variant_id: i.variant_id, variant_label: i.variant_label ?? null, unit_cost: i.unit_cost ?? null } : {}),
    }))

    if (itemRows.length === 0 && Number(b.total) > 0) {
      itemRows.push({
        order_id: order.id, product_id: null,
        name: (orderPayload.service_name as string) || 'Item', description: null,
        quantity: 1, unit_price: Number(b.total), discount: 0, discount_type: 'amount',
        subtotal: Number(b.total), width: null, height: null, area: null,
        measurement_unit: null, finishings: [], finishing_type: null, technical_notes: null,
      })
    }

    let insertedOrderItems: { id: string }[] = []
    if (itemRows.length > 0) {
      const { data: ins, error: itemsErr } = await db.from('order_items').insert(itemRows).select('id')
      if (itemsErr) throw new Error(itemsErr.message)
      insertedOrderItems = ins ?? []
    }

    // Copiar arte anexada a cada item do orçamento para o pedido recém-criado
    if (bi && bi.length > 0 && insertedOrderItems.length === bi.length) {
      const { data: budgetFiles } = await db
        .from('budget_item_files')
        .select('*')
        .eq('budget_id', b.id)
      if (budgetFiles && budgetFiles.length > 0) {
        for (let idx = 0; idx < bi.length; idx++) {
          const filesForItem = budgetFiles.filter((f: any) => f.budget_item_id === bi[idx].id)
          for (const f of filesForItem) {
            const ext = f.file_path.split('.').pop()
            const newPath = `${companyId}/${order.id}/${randomUUID()}.${ext}`
            const { error: copyErr } = await db.storage.from('order-files').copy(f.file_path, newPath)
            if (copyErr) { console.error('[convertBudgetToOrder] copiar arte do item', copyErr); continue }
            const { data: urlData } = db.storage.from('order-files').getPublicUrl(newPath)
            await db.from('order_files').insert([{
              order_id: order.id,
              company_id: companyId,
              file_name: f.file_name,
              file_url: urlData.publicUrl,
              file_path: newPath,
              file_size: f.file_size,
              mime_type: f.mime_type,
              uploaded_by: 'equipe',
            }])
          }
        }
      }
    }

    // Marcar orçamento como convertido
    await db.from('budgets').update({
      status: 'converted',
      converted_to_order_id: order.id,
      updated_at: new Date().toISOString(),
    }).eq('id', b.id)

    // Agenda: se o prazo de entrega for numérico (dias), criar tarefa
    const delivDaysNum = Number(b.delivery_days)
    if (Number.isFinite(delivDaysNum) && delivDaysNum > 0 && order?.id) {
      const dueDate = new Date(Date.now() + delivDaysNum * 86400000)
      await db.from('calendar_tasks').insert([{
        company_id: companyId,
        title: `Entrega — ${order.order_number}`,
        description: `Pedido originado do orçamento ${b.budget_number || ''}`,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
        priority: 'normal',
        order_id: order.id,
      }])
    }

    return { ok: true, orderId: order.id, orderNumber: order.order_number }
  } catch (err: unknown) {
    console.error('[convertBudgetToOrder]', err)
    return { ok: false, error: (err as Error).message }
  }
}
