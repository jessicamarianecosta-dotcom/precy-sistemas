import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { buildPixPayload, sanitizeTxid } from '@/lib/pix/brcode'
import { companyPickupAddressLines } from '@/lib/company/pickupAddress'
import QRCode from 'qrcode'

/**
 * GET /api/loja/orcamento/[token]
 * Rota pública — abre o orçamento pelo token opaco (budgets.public_token,
 * UUID não listável/não sequencial). Nunca consulta `budgets` via client
 * anônimo: tudo aqui usa supabaseAdmin (service role) e filtra manualmente
 * pelo token, replicando o mesmo padrão de /api/loja/pedido/[ref].
 *
 * Side-effect: registra a primeira/última visualização e incrementa
 * view_count; se o status ainda for 'sent', avança para 'viewed'.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = String((await params).token ?? '')
  if (!token) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })

  if (!checkRateLimit(`loja-orcamento-ver:${getClientIp(request)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const db = supabaseAdmin as any

  const { data: budget, error } = await db
    .from('budgets')
    .select(`
      id, budget_number, status, subtotal, discount, total, notes, valid_until,
      payment_method, pay_condition, installments, signal_amount,
      delivery_type, delivery_fee, delivery_addr, delivery_days, production_days,
      prazo_type, prazo_dias, prazo_due_date,
      pix_type, pix_key, pix_label, pix_txid, payment_status,
      sent_at, first_viewed_at, last_viewed_at, view_count,
      approved_at, rejected_at, rejection_reason,
      converted_to_order_id, created_at,
      customers(name, phone, email, cpf_cnpj, city, state, address),
      companies(id, name, email, phone, logo_url, primary_color, secondary_color,
                cnpj, address, street, number, complement, neighborhood, city, state, zip_code,
                pix_type, pix_key, pix_label)
    `)
    .eq('public_token', token)
    .maybeSingle()

  if (error || !budget) {
    return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })
  }

  // Nunca expor um orçamento ainda não enviado (rascunho interno do lojista)
  if (budget.status === 'draft') {
    return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })
  }

  const { data: items, error: itemsError } = await db
    .from('budget_items')
    .select(`
      id, product_id, name, description, quantity, unit_price, subtotal,
      width, height, area, measurement_unit, finishings, finishing_type, technical_notes,
      variant_label
    `)
    .eq('budget_id', budget.id)
    .order('created_at', { ascending: true })
  if (itemsError) console.error('[loja/orcamento] erro ao buscar itens', itemsError)

  const itemIds = (items ?? []).map((i: any) => i.id)
  const productIds = (items ?? []).map((i: any) => i.product_id).filter(Boolean)

  const [{ data: files, error: filesError }, { data: productImages, error: imagesError }] = await Promise.all([
    itemIds.length > 0
      ? db.from('budget_item_files').select('budget_item_id, file_url, file_name, file_size, mime_type').in('budget_item_id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length > 0
      ? db.from('product_images').select('product_id, url, sort_order').in('product_id', productIds).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (filesError) console.error('[loja/orcamento] erro ao buscar arquivos do item', filesError)
  if (imagesError) console.error('[loja/orcamento] erro ao buscar imagens do produto', imagesError)

  const firstImageByProduct = new Map<string, string>()
  for (const img of productImages ?? []) {
    if (!firstImageByProduct.has(img.product_id)) firstImageByProduct.set(img.product_id, img.url)
  }
  const filesByItem = new Map<string, any[]>()
  for (const f of files ?? []) {
    const arr = filesByItem.get(f.budget_item_id) ?? []
    arr.push(f)
    filesByItem.set(f.budget_item_id, arr)
  }

  const itemsOut = (items ?? []).map((i: any) => {
    const itemFilesImages = (filesByItem.get(i.id) ?? [])
      .filter((f: any) => (f.mime_type || '').startsWith('image/'))
      .map((f: any) => f.file_url)
    const image = itemFilesImages[0] ?? (i.product_id ? firstImageByProduct.get(i.product_id) ?? null : null)
    return {
      id: i.id,
      name: i.name,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.subtotal,
      variant_label: i.variant_label,
      finishings: i.finishings,
      finishing_type: i.finishing_type,
      width: i.width,
      height: i.height,
      area: i.area,
      measurement_unit: i.measurement_unit,
      technical_notes: i.technical_notes,
      image,
    }
  })

  // Arte enviada pelo cliente — galeria completa (imagens e outros arquivos),
  // exatamente como aparece no PDF do orçamento (não só a 1ª imagem de cada item).
  const artFiles = (files ?? []).map((f: any) => ({
    file_name: f.file_name,
    file_url: f.file_url,
    file_size: f.file_size,
    is_image: (f.mime_type || '').startsWith('image/'),
  }))

  const pickupAddressLines = budget.delivery_type === 'pickup'
    ? companyPickupAddressLines(budget.companies)
    : []

  const isExpired = !!budget.valid_until
    && new Date(budget.valid_until) < new Date()
    && !['approved', 'converted'].includes(budget.status)

  // Registrar visualização (não bloqueia a resposta em caso de falha)
  const now = new Date().toISOString()
  const viewUpdate: Record<string, unknown> = {
    last_viewed_at: now,
    view_count: (Number(budget.view_count) || 0) + 1,
  }
  if (!budget.first_viewed_at) viewUpdate.first_viewed_at = now
  if (budget.status === 'sent') viewUpdate.status = 'viewed'
  await db.from('budgets').update(viewUpdate).eq('id', budget.id)

  // PIX: snapshot do próprio orçamento tem prioridade; cai para a chave
  // atual da empresa só se o orçamento nunca teve uma gravada.
  const pixKey = budget.pix_key || budget.companies?.pix_key || null
  const pixType = budget.pix_type || budget.companies?.pix_type || null
  const pixLabel = budget.pix_label || budget.companies?.pix_label || budget.companies?.name || null

  let pix: { key: string; type: string | null; label: string | null; amount: number; payload: string; qrCodeBase64: string } | null = null
  if (pixKey) {
    const amount = budget.pay_condition === 'entrada' && Number(budget.signal_amount) > 0
      ? Number(budget.signal_amount)
      : Number(budget.total) || 0

    let txid = budget.pix_txid
    if (!txid) {
      txid = sanitizeTxid(budget.budget_number || budget.id)
      await db.from('budgets').update({ pix_txid: txid }).eq('id', budget.id)
    }

    try {
      const payload = buildPixPayload({
        pixKey,
        merchantName: budget.companies?.name || 'RECEBEDOR',
        merchantCity: budget.companies?.city || 'BRASIL',
        amount,
        txid,
      })
      const qrCodeBase64 = await QRCode.toDataURL(payload, { margin: 1, width: 320 })
      pix = { key: pixKey, type: pixType, label: pixLabel, amount, payload, qrCodeBase64 }
    } catch (err) {
      console.error('[loja/orcamento] erro ao gerar BR Code Pix', err)
    }
  }

  return NextResponse.json({
    budget: {
      id: budget.id,
      budget_number: budget.budget_number,
      status: budget.status,
      subtotal: budget.subtotal,
      discount: budget.discount,
      total: budget.total,
      notes: budget.notes,
      valid_until: budget.valid_until,
      created_at: budget.created_at,
      payment_method: budget.payment_method,
      pay_condition: budget.pay_condition,
      installments: budget.installments,
      signal_amount: budget.signal_amount,
      delivery_type: budget.delivery_type,
      delivery_fee: budget.delivery_fee,
      delivery_addr: budget.delivery_addr,
      delivery_days: budget.delivery_days,
      production_days: budget.production_days,
      prazo_type: budget.prazo_type,
      prazo_dias: budget.prazo_dias,
      prazo_due_date: budget.prazo_due_date,
      payment_status: budget.payment_status,
      approved_at: budget.approved_at,
      rejected_at: budget.rejected_at,
      rejection_reason: budget.rejection_reason,
      converted: !!budget.converted_to_order_id,
      is_expired: isExpired,
      customer_name: budget.customers?.name ?? null,
      customer_phone: budget.customers?.phone ?? null,
      customer_email: budget.customers?.email ?? null,
      customer_cpf_cnpj: budget.customers?.cpf_cnpj ?? null,
      customer_city: budget.customers?.city ?? null,
      customer_state: budget.customers?.state ?? null,
      customer_address: budget.customers?.address ?? null,
    },
    company: {
      name: budget.companies?.name ?? '',
      email: budget.companies?.email ?? null,
      phone: budget.companies?.phone ?? null,
      cnpj: budget.companies?.cnpj ?? null,
      logo_url: budget.companies?.logo_url ?? null,
      primary_color: budget.companies?.primary_color ?? '#8B6C4F',
      secondary_color: budget.companies?.secondary_color ?? '#2C2018',
      pickup_address_lines: pickupAddressLines,
    },
    items: itemsOut,
    art_files: artFiles,
    pix,
  })
}
