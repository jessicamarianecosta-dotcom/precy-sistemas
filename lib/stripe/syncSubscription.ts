/**
 * Lógica de sincronização Stripe → companies, compartilhada entre o
 * webhook (assíncrono, fonte de verdade) e /api/stripe/checkout-return
 * (síncrono, roda no redirecionamento de volta do Checkout — garante que
 * o acesso já está liberado antes do middleware avaliar a próxima
 * navegação, sem depender só da entrega do webhook).
 */
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Stripe from 'stripe'

export async function updateCompany(companyId: string, data: Record<string, unknown>, logPrefix = '[stripe-sync]') {
  const { error } = await (supabaseAdmin.from('companies') as any)
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', companyId)
  if (error) console.error(`${logPrefix} updateCompany error:`, JSON.stringify(error))
  else console.log(`${logPrefix} updated company=${companyId}`, Object.keys(data))
}

async function findCompanyByCustomer(customerId: string): Promise<string | null> {
  const { data } = await (supabaseAdmin.from('companies') as any)
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.id ?? null
}

export async function getCompanyId(obj: { metadata?: Stripe.Metadata | null; customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null }): Promise<string | null> {
  const meta = obj.metadata
  if (meta?.company_id) return meta.company_id
  const customerId = typeof obj.customer === 'string' ? obj.customer : (obj.customer as any)?.id
  if (customerId) return findCompanyByCustomer(customerId)
  return null
}

export async function syncCompanyFromCheckoutSession(cs: Stripe.Checkout.Session, logPrefix = '[stripe-sync]'): Promise<string | null> {
  if (cs.payment_status !== 'paid' && cs.mode !== 'subscription') return null
  const companyId = await getCompanyId(cs)
  const plan      = cs.metadata?.plan ?? 'basic'
  const subId     = cs.subscription as string | null
  if (!companyId) { console.warn(`${logPrefix} checkout.completed: company not found`); return null }

  const update: Record<string, unknown> = {
    stripe_customer_id: cs.customer as string,
    current_plan:       plan,
    grace_period_end:   null,
    blocked_at:         null,
  }

  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId)
    update.stripe_subscription_id = subId
    update.subscription_status    = sub.status
    update.current_period_end     = new Date((sub as any).current_period_end * 1000).toISOString()
    update.trial_end              = (sub as any).trial_end
      ? new Date((sub as any).trial_end * 1000).toISOString() : null
  } else {
    update.subscription_status = 'active'
  }

  await updateCompany(companyId, update, logPrefix)
  return companyId
}

export async function syncCompanyFromSubscription(sub: Stripe.Subscription, logPrefix = '[stripe-sync]'): Promise<string | null> {
  const companyId = await getCompanyId(sub)
  if (!companyId) { console.warn(`${logPrefix} subscription: company not found`); return null }

  const priceId = sub.items.data[0]?.price.id ?? ''
  const rawPlan = getPlanFromPriceId(priceId)

  // Mesma regra documentada no webhook: status que já significam "parou de
  // pagar de verdade" derrubam current_plan pra basic imediatamente, mesmo
  // antes do customer.subscription.deleted final.
  const INACTIVE_STATUSES = ['canceled', 'unpaid', 'incomplete_expired']
  const plan = INACTIVE_STATUSES.includes(sub.status) ? 'basic' : rawPlan

  await updateCompany(companyId, {
    current_plan:        plan,
    subscription_status: sub.status,
    current_period_end:  new Date((sub as any).current_period_end * 1000).toISOString(),
    trial_end:           (sub as any).trial_end
      ? new Date((sub as any).trial_end * 1000).toISOString() : null,
    grace_period_end:    null,
    blocked_at:          null,
  }, logPrefix)
  return companyId
}
