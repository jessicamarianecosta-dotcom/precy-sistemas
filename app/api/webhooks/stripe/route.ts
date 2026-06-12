import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Stripe from 'stripe'

export const runtime = 'nodejs'

async function upsertCompanySubscription(
  companyId: string,
  updates: Record<string, unknown>
) {
  const { error } = await (supabaseAdmin.from('companies') as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', companyId)
  if (error) console.error('[webhook] upsert error:', error)
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhook] signature failed:', err)
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {

      /* ── Checkout finalizado com sucesso ── */
      case 'checkout.session.completed': {
        const cs = event.data.object as Stripe.Checkout.Session
        const companyId = cs.metadata?.company_id
        const plan      = cs.metadata?.plan ?? 'basic'
        const subId     = cs.subscription as string

        if (!companyId || !subId) break

        const sub = await stripe.subscriptions.retrieve(subId)
        await upsertCompanySubscription(companyId, {
          stripe_subscription_id: subId,
          current_plan:           plan,
          subscription_status:    sub.status,
          current_period_end:     new Date((sub as any).current_period_end * 1000).toISOString(),
          trial_end:              (sub as any).trial_end
            ? new Date((sub as any).trial_end * 1000).toISOString()
            : null,
        })
        console.log(`[webhook] checkout.completed company=${companyId} plan=${plan}`)
        break
      }

      /* ── Assinatura atualizada (upgrade/downgrade/cancelamento) ── */
      case 'customer.subscription.updated': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = sub.metadata?.company_id
        if (!companyId) break

        const priceId  = (sub.items.data[0]?.price.id) ?? ''
        const plan     = getPlanFromPriceId(priceId)
        const isCanceled = sub.cancel_at_period_end || sub.status === 'canceled'

        await upsertCompanySubscription(companyId, {
          current_plan:           isCanceled ? 'basic' : plan,
          subscription_status:    sub.status,
          current_period_end:     new Date((sub as any).current_period_end * 1000).toISOString(),
          trial_end:              (sub as any).trial_end
            ? new Date((sub as any).trial_end * 1000).toISOString()
            : null,
        })
        console.log(`[webhook] subscription.updated company=${companyId} plan=${plan} status=${sub.status}`)
        break
      }

      /* ── Assinatura cancelada definitivamente ── */
      case 'customer.subscription.deleted': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = sub.metadata?.company_id
        if (!companyId) break

        await upsertCompanySubscription(companyId, {
          current_plan:        'basic',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
        })
        console.log(`[webhook] subscription.deleted company=${companyId}`)
        break
      }

      /* ── Fatura paga com sucesso ── */
      case 'invoice.paid': {
        const invoice   = event.data.object as Stripe.Invoice
        const subId     = invoice.subscription as string
        if (!subId) break

        const sub       = await stripe.subscriptions.retrieve(subId)
        const companyId = sub.metadata?.company_id
        if (!companyId) break

        await upsertCompanySubscription(companyId, {
          subscription_status: 'active',
          current_period_end:  new Date((sub as any).current_period_end * 1000).toISOString(),
        })
        break
      }

      /* ── Falha no pagamento ── */
      case 'invoice.payment_failed': {
        const invoice   = event.data.object as Stripe.Invoice
        const subId     = invoice.subscription as string
        if (!subId) break

        const sub       = await stripe.subscriptions.retrieve(subId)
        const companyId = sub.metadata?.company_id
        if (!companyId) break

        await upsertCompanySubscription(companyId, {
          subscription_status: 'past_due',
        })
        console.log(`[webhook] payment_failed company=${companyId}`)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook] processing error:', err)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
