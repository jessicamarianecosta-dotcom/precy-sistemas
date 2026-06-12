import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, PlanId } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { plan } = await req.json()
    const planConfig = PLANS[plan as PlanId]
    if (!planConfig || !planConfig.price_id) {
      return NextResponse.json({ error: 'Plano inválido ou price_id não configurado' }, { status: 400 })
    }

    // Buscar company do usuário
    const { data: company } = await (supabaseAdmin.from('companies') as any)
      .select('id, stripe_customer_id')
      .eq('user_id', session.user.id)
      .single()

    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    // Criar ou reutilizar customer Stripe
    let customerId = company.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: { user_id: session.user.id, company_id: company.id },
      })
      customerId = customer.id
      await (supabaseAdmin.from('companies') as any)
        .update({ stripe_customer_id: customerId })
        .eq('id', company.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://precyplus.com.br'

    const checkoutSession = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.price_id, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url:  `${appUrl}/configuracoes?tab=plano`,
      metadata:    { user_id: session.user.id, company_id: company.id, plan },
      subscription_data: {
        trial_period_days: planConfig.trialDays > 0 ? planConfig.trialDays : undefined,
        metadata:          { user_id: session.user.id, company_id: company.id, plan },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('[stripe/checkout]', err)
    return NextResponse.json({ error: 'Erro ao criar sessão de pagamento' }, { status: 500 })
  }
}
