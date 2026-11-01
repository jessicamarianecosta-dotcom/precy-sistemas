import { NextRequest, NextResponse } from 'next/server'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * PUT /api/loja/pagamentos/mercadopago/configurar
 * Body: { pixEnabled, cardEnabled, cardMaxInstallments, surchargeMode }
 *
 * Nunca confia no client para decidir se pode habilitar Pix/cartão: ambos
 * exigem conta conectada — sem isso, o checkout ficaria oferecendo uma
 * forma de pagamento que não tem como cobrar.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const account = await getPaymentGateway().getAccountStatus(auth.companyId)
  const pixEnabled = !!body.pixEnabled && account.connected
  const cardEnabled = !!body.cardEnabled && account.connected
  const cardMaxInstallments = Math.min(3, Math.max(1, Number(body.cardMaxInstallments) || 1))
  const surchargeMode = body.surchargeMode === 'absorb' ? 'absorb' : 'pass_to_customer'

  if ((body.pixEnabled || body.cardEnabled) && !account.connected) {
    return NextResponse.json({ error: 'Conecte a conta Mercado Pago antes de habilitar Pix ou cartão.' }, { status: 409 })
  }

  const { error } = await (supabaseAdmin.from('store_payment_settings') as any)
    .upsert([{
      company_id: auth.companyId,
      provider: 'mercadopago',
      pix_enabled: pixEnabled,
      card_enabled: cardEnabled,
      card_max_installments: cardMaxInstallments,
      surcharge_mode: surchargeMode,
    }], { onConflict: 'company_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
