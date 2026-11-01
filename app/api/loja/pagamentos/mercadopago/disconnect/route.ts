import { NextResponse } from 'next/server'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/** POST /api/loja/pagamentos/mercadopago/disconnect — também desliga Pix/cartão para não deixar o checkout tentando cobrar sem conta. */
export async function POST() {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  try {
    await getPaymentGateway().disconnectAccount(auth.companyId)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao desconectar' }, { status: 500 })
  }

  await (supabaseAdmin.from('store_payment_settings') as any)
    .upsert([{ company_id: auth.companyId, pix_enabled: false, card_enabled: false }], { onConflict: 'company_id' })

  return NextResponse.json({ ok: true })
}
