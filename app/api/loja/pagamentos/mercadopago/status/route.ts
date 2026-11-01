import { NextResponse } from 'next/server'
import { requireCatalogAccess } from '@/lib/catalog/server-auth'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { listFeeRules } from '@/lib/catalog/payments/feeRules'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/loja/pagamentos/mercadopago/status
 *
 * Nunca devolve token nenhum — só os campos públicos (status da conexão,
 * id/nome da conta, chave pública) e as taxas configuradas, para a tela
 * Configurações > Loja online > Pagamentos.
 */
export async function GET() {
  const auth = await requireCatalogAccess()
  if (!auth.ok) return auth.response

  const [account, settingsRes, feeRules] = await Promise.all([
    getPaymentGateway().getAccountStatus(auth.companyId),
    (supabaseAdmin.from('store_payment_settings') as any).select('*').eq('company_id', auth.companyId).maybeSingle(),
    listFeeRules(auth.companyId),
  ])

  return NextResponse.json({
    account,
    settings: settingsRes.data ?? {
      company_id: auth.companyId,
      provider: 'mercadopago',
      pix_enabled: true,
      card_enabled: false,
      card_max_installments: 1,
      surcharge_mode: 'pass_to_customer',
    },
    feeRules,
  })
}
