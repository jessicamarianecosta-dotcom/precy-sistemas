import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { supabaseAdmin }              from '@/lib/supabase/admin'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const GRACE_DAYS = 5

async function updateCompany(companyId: string, data: Record<string, unknown>) {
  const { error } = await (supabaseAdmin.from('companies') as any)
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', companyId)
  if (error) console.error('[webhook] updateCompany error:', JSON.stringify(error))
  else console.log(`[webhook] updated company=${companyId}`, Object.keys(data))
}

async function findCompanyByCustomer(customerId: string): Promise<string | null> {
  const { data } = await (supabaseAdmin.from('companies') as any)
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.id ?? null
}

async function getCompanyId(obj: { metadata?: Stripe.Metadata | null; customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null }): Promise<string | null> {
  const meta = obj.metadata
  if (meta?.company_id) return meta.company_id
  const customerId = typeof obj.customer === 'string' ? obj.customer : (obj.customer as any)?.id
  if (customerId) return findCompanyByCustomer(customerId)
  return null
}

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

      /* ── Checkout concluído ── */
      case 'checkout.session.completed': {
        const cs = event.data.object as Stripe.Checkout.Session
        if (cs.payment_status !== 'paid' && cs.mode !== 'subscription') break
        const companyId = await getCompanyId(cs)
        const plan      = cs.metadata?.plan ?? 'basic'
        const subId     = cs.subscription as string | null
        if (!companyId) { console.warn('[webhook] checkout.completed: company not found'); break }

        const update: Record<string, unknown> = {
          stripe_customer_id: cs.customer as string,
          current_plan:       plan,
          grace_period_end:   null,
          blocked_at:         null,
        }

        if (subId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId)
            update.stripe_subscription_id = subId
            update.subscription_status    = sub.status
            update.current_period_end     = new Date((sub as any).current_period_end * 1000).toISOString()
            update.trial_end              = (sub as any).trial_end
              ? new Date((sub as any).trial_end * 1000).toISOString() : null
          } catch (e) { console.error('[webhook] retrieve sub failed:', e) }
        } else {
          update.subscription_status = 'active'
        }

        await updateCompany(companyId, update)
        break
      }

      /* ── Assinatura atualizada ── */
      case 'customer.subscription.updated': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = await getCompanyId(sub)
        if (!companyId) { console.warn('[webhook] subscription.updated: company not found'); break }

        const priceId  = sub.items.data[0]?.price.id ?? ''
        const plan     = getPlanFromPriceId(priceId)

        // Importante: mesmo com cancel_at_period_end=true (cliente agendou
        // cancelamento pelo Portal), o plano contratado continua ativo até
        // o período pago realmente terminar — Stripe dispara
        // customer.subscription.deleted (que já faz o downgrade para
        // basic) só quando isso acontece de verdade. Fazer o downgrade
        // aqui cortaria o acesso de um cliente que já pagou o período.
        await updateCompany(companyId, {
          current_plan:          plan,
          subscription_status:   sub.status,
          current_period_end:    new Date((sub as any).current_period_end * 1000).toISOString(),
          trial_end:             (sub as any).trial_end
            ? new Date((sub as any).trial_end * 1000).toISOString() : null,
          grace_period_end:      null,
          blocked_at:            null,
        })
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
