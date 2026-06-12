import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { supabaseAdmin }              from '@/lib/supabase/admin'
import Stripe from 'stripe'

export const runtime = 'nodejs'
const GRACE_DAYS = 5

async function updateCompany(companyId: string, data: Record<string, unknown>) {
  const { error } = await (supabaseAdmin.from('companies') as any)
    .update({ ...data, updated_at: new Date().toISOString() }).eq('id', companyId)
  if (error) console.error('[webhook] updateCompany error:', error)
}

async function findCompanyByCustomer(customerId: string): Promise<string | null> {
  const { data } = await (supabaseAdmin.from('companies') as any)
    .select('id').eq('stripe_customer_id', customerId).single()
  return data?.id ?? null
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] signature failed:', err)
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const cs        = event.data.object as Stripe.Checkout.Session
        const companyId = cs.metadata?.company_id
        const plan      = cs.metadata?.plan ?? 'basic'
        const subId     = cs.subscription as string
        if (!companyId || !subId) break
        const sub = await stripe.subscriptions.retrieve(subId)
        await updateCompany(companyId, {
          stripe_subscription_id: subId,
          stripe_customer_id:     cs.customer as string,
          current_plan:           plan,
          subscription_status:    sub.status,
          current_period_end:     new Date((sub as any).current_period_end * 1000).toISOString(),
          grace_period_end:       null,
          blocked_at:             null,
          trial_end:              (sub as any).trial_end
            ? new Date((sub as any).trial_end * 1000).toISOString() : null,
        })
        console.log(`[webhook] checkout.completed companyId=${companyId} plan=${plan}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const companyId = sub.metadata?.company_id
          ?? await findCompanyByCustomer(sub.customer as string)
        if (!companyId) break
        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan    = getPlanFromPriceId(priceId)
        await updateCompany(companyId, {
          current_plan:          plan,
          subscription_status:   sub.status,
          current_period_end:    new Date((sub as any).current_period_end * 1000).toISOString(),
          trial_end:             (sub as any).trial_end
            ? new Date((sub as any).trial_end * 1000).toISOString() : null,
          blocked_at: null,
          grace_period_end: null,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const companyId = sub.metadata?.company_id
          ?? await findCompanyByCustomer(sub.customer as string)
        if (!companyId) break
        await updateCompany(companyId, {
          subscription_status: 'canceled',
          current_plan:        'basic',
          stripe_subscription_id: null,
        })
        break
      }

      case 'invoice.paid': {
        const invoice   = event.data.object as Stripe.Invoice
        const subId     = invoice.subscription as string
        if (!subId) break
        const sub       = await stripe.subscriptions.retrieve(subId)
        const companyId = sub.metadata?.company_id
          ?? await findCompanyByCustomer(sub.customer as string)
        if (!companyId) break
        await updateCompany(companyId, {
          subscription_status: 'active',
          current_period_end:  new Date((sub as any).current_period_end * 1000).toISOString(),
          grace_period_end:    null,
          blocked_at:          null,
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice   = event.data.object as Stripe.Invoice
        const subId     = invoice.subscription as string
        if (!subId) break
        const sub       = await stripe.subscriptions.retrieve(subId)
        const companyId = sub.metadata?.company_id
          ?? await findCompanyByCustomer(sub.customer as string)
        if (!companyId) break
        // Calcular grace period: +5 dias
        const periodEnd  = new Date((sub as any).current_period_end * 1000)
        const graceEnd   = new Date(periodEnd.getTime() + GRACE_DAYS * 86400000)
        await updateCompany(companyId, {
          subscription_status: 'past_due',
          grace_period_end:    graceEnd.toISOString(),
        })
        console.log(`[webhook] payment_failed companyId=${companyId} grace until ${graceEnd.toISOString()}`)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook] processing error:', err)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
