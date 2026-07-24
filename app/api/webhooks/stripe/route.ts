import { NextRequest, NextResponse } from 'next/server'
import { stripe }                     from '@/lib/stripe'
import { supabaseAdmin }              from '@/lib/supabase/admin'
import {
  updateCompany, getCompanyId,
  syncCompanyFromCheckoutSession, syncCompanyFromSubscription,
} from '@/lib/stripe/syncSubscription'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const GRACE_DAYS = 5

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sem assinatura Stripe' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.includes('xxx')) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET não configurado')
    return NextResponse.json({ error: 'Webhook secret não configurado' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err?.message)
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  console.log(`[webhook] received: ${event.type} id=${event.id}`)

  try {
    switch (event.type) {

      /* ── Checkout concluído ──
         Também é sincronizado de forma síncrona em /api/stripe/checkout-return
         (redirect de volta do Checkout) — este case continua existindo como
         fonte de verdade assíncrona e rede de segurança caso aquele
         redirecionamento falhe ou o usuário feche a aba antes dele rodar. */
      case 'checkout.session.completed': {
        const cs = event.data.object as Stripe.Checkout.Session
        await syncCompanyFromCheckoutSession(cs, '[webhook]')
        break
      }

      /* ── Assinatura criada/atualizada ──
         Importante: mesmo com cancel_at_period_end=true (cliente agendou
         cancelamento pelo Portal), o plano contratado continua ativo até
         o período pago realmente terminar — Stripe dispara
         customer.subscription.deleted (que já faz o downgrade para basic)
         só quando isso acontece de verdade. Fazer o downgrade aqui cortaria
         o acesso de um cliente que já pagou o período.

         Mas para status que já significam "parou de pagar de verdade"
         (canceled/unpaid/incomplete_expired — Stripe manda esses via
         subscription.updated, não só via subscription.deleted, e pode
         levar dias entre um e outro nas tentativas automáticas de
         cobrança), current_plan precisa refletir isso imediatamente — ver
         syncCompanyFromSubscription. Antes, current_plan continuava 'pro'
         nesses casos até o delete final — e como company_has_pro_access()
         tratava current_plan='pro' como acesso liberado independente do
         status, isso mantinha acesso completo às tabelas financeiras
         mesmo inadimplente. */
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await syncCompanyFromSubscription(sub, '[webhook]')
        break
      }

      /* ── Assinatura cancelada ── */
      case 'customer.subscription.deleted': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = await getCompanyId(sub)
        if (!companyId) { console.warn('[webhook] subscription.deleted: company not found'); break }
        await updateCompany(companyId, {
          subscription_status:    'canceled',
          current_plan:           'basic',
          stripe_subscription_id: null,
        })
        break
      }

      /* ── Fatura paga ── */
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break
        const sub     = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const companyId = await getCompanyId(sub)
        if (!companyId) { console.warn('[webhook] invoice.paid: company not found'); break }
        await updateCompany(companyId, {
          subscription_status: 'active',
          current_period_end:  new Date((sub as any).current_period_end * 1000).toISOString(),
          grace_period_end:    null,
          blocked_at:          null,
        })
        break
      }

      /* ── Falha no pagamento ── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break
        const sub     = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const companyId = await getCompanyId(sub)
        if (!companyId) { console.warn('[webhook] invoice.payment_failed: company not found'); break }
        const periodEnd = (sub as any).current_period_end
          ? new Date((sub as any).current_period_end * 1000)
          : new Date()
        const graceEnd  = new Date(periodEnd.getTime() + GRACE_DAYS * 86400000)
        await updateCompany(companyId, {
          subscription_status: 'past_due',
          grace_period_end:    graceEnd.toISOString(),
        })
        break
      }

      /* ── Trial terminando ── */
      case 'customer.subscription.trial_will_end': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = await getCompanyId(sub)
        if (companyId) console.log(`[webhook] trial_will_end company=${companyId}`)
        break
      }

      default:
        console.log(`[webhook] unhandled event: ${event.type}`)
    }

    return NextResponse.json({ received: true, event: event.type })
  } catch (err: any) {
    console.error('[webhook] processing error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro ao processar evento' }, { status: 500 })
  }
}
