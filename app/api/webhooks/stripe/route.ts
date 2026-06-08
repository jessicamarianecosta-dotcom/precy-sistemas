import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature failed:', err)
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session      = event.data.object as Stripe.CheckoutSession
        const userId       = session.metadata?.user_id
        const subId        = session.subscription as string

        if (userId && subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status:                 'active',
              plan:                   'pro',
              stripe_subscription_id: subId,
              current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
              updated_at:             new Date().toISOString(),
            })
            .eq('user_id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id

        if (userId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status:               sub.status === 'active' ? 'active' : sub.status === 'canceled' ? 'cancelled' : 'expired',
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
              updated_at:           new Date().toISOString(),
            })
            .eq('user_id', userId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id

        if (userId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status:     'cancelled',
              plan:       'basic',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId   = invoice.subscription as string

        if (subId) {
          const sub    = await stripe.subscriptions.retrieve(subId)
          const userId = sub.metadata?.user_id
          if (userId) {
            await supabaseAdmin
              .from('subscriptions')
              .update({ status: 'expired', updated_at: new Date().toISOString() })
              .eq('user_id', userId)
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
