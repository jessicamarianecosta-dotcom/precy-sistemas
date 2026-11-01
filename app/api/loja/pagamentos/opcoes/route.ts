import { NextRequest, NextResponse } from 'next/server'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPaymentGateway } from '@/lib/catalog/payments'
import { getFeeRule } from '@/lib/catalog/payments/feeRules'
import { buildInstallmentBreakdown } from '@/lib/catalog/payments/feeCalculator'

export const runtime = 'nodejs'

/**
 * GET /api/loja/pagamentos/opcoes?slug=lumilife&amount=99.90
 *
 * Rota pública (visitante da loja) — devolve só o que o checkout precisa
 * para exibir o preço de cada forma de pagamento ANTES do cliente
 * escolher: nenhum dado sensível (nunca token de acesso), e o `amount`
 * informado aqui é só para pré-visualização — a cobrança real sempre
 * recalcula tudo a partir do carrinho revalidado no servidor.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  const amount = Number(req.nextUrl.searchParams.get('amount') ?? 0)

  if (!slug || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })

  const { data: settings } = await (supabaseAdmin.from('store_payment_settings') as any)
    .select('pix_enabled, card_enabled, card_max_installments, surcharge_mode')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!settings) {
    return NextResponse.json({ pixEnabled: false, cardEnabled: false, maxInstallments: 1, publicKey: null, pix: null, card: [] })
  }

  const account = await getPaymentGateway().getAccountStatus(companyId)
  const pixEnabled = !!settings.pix_enabled && account.connected
  const cardEnabled = !!settings.card_enabled && account.connected

  let pix = null
  if (pixEnabled) {
    pix = { amount } // preço no Pix é o preço cadastrado, sem acréscimo
  }

  const card: Array<{ installments: number; installmentAmount: number; totalAmount: number }> = []
  if (cardEnabled) {
    const max = settings.surcharge_mode === 'absorb' ? settings.card_max_installments : settings.card_max_installments
    for (let n = 1; n <= max; n++) {
      try {
        const rule = await getFeeRule(companyId, 'credit_card', n)
        const effectiveNet = settings.surcharge_mode === 'absorb' ? amount : amount // absorb = cliente paga igual; cálculo abaixo ajusta
        const breakdown = buildInstallmentBreakdown(effectiveNet, n, rule)
        card.push({
          installments: n,
          installmentAmount: settings.surcharge_mode === 'absorb' ? Number((amount / n).toFixed(2)) : breakdown.installmentAmount,
          totalAmount: settings.surcharge_mode === 'absorb' ? amount : breakdown.totalAmount,
        })
      } catch {
        // Sem taxa cadastrada para esse número de parcelas: não oferece a modalidade
        // em vez de estimar um valor que pode estar errado.
        break
      }
    }
  }

  return NextResponse.json({
    pixEnabled,
    cardEnabled,
    maxInstallments: settings.card_max_installments ?? 1,
    publicKey: account.publicKey ?? null,
    pix,
    card,
  })
}
