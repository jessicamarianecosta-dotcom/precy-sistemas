import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, PlanId }     from '@/lib/stripe'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin }             from '@/lib/supabase/admin'
import { cookies }                   from 'next/headers'
import { checkRateLimit }            from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    if (!checkRateLimit(`stripe-checkout:${session.user.id}`, 10, 5 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
    }

    const body = await req.json()
    const plan = body.plan as PlanId

    const planConfig = PLANS[plan]
    if (!planConfig) {
      return NextResponse.json({ error: `Plano "${plan}" inválido` }, { status: 400 })
    }
    if (!planConfig.price_id || planConfig.price_id.startsWith('price_xxx') || planConfig.price_id === '') {
      return NextResponse.json({
        error: `price_id do plano ${plan} não configurado. Configure STRIPE_PRICE_ID_${plan.toUpperCase()} no Vercel.`
      }, { status: 400 })
    }

    // ── Buscar empresa ──
    const { data: company, error: coErr } = await (supabaseAdmin.from('companies') as any)
      .select('id, stripe_customer_id, subscription_status, stripe_subscription_id')
      .eq('user_id', session.user.id)
      .single()

    if (coErr || !company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    // ── Verificar se já tem assinatura ativa deste plano ──
    if (company.subscription_status === 'active' && company.stripe_subscription_id) {
      try {
        const existing = await stripe.subscriptions.retrieve(company.stripe_subscription_id)
        const existingPriceId = existing.items.data[0]?.price.id
        if (existingPriceId === planConfig.price_id && existing.status === 'active') {
          return NextResponse.json({ error: 'Você já possui este plano ativo.' }, { status: 409 })
        }
      } catch { /* subscription não existe mais — prosseguir */ }
    }

    // ── Garantir Stripe Customer (sem duplicar) ──
    let customerId = company.stripe_customer_id as string | null

    if (!customerId) {
      // Verificar se já existe um customer com este e-mail
      const existing = await stripe.customers.list({ email: session.user.email, limit: 1 })
      if (existing.data.length > 0) {
        customerId = existing.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: session.user.email!,
          metadata: { user_id: session.user.id, company_id: company.id },
        })
        customerId = customer.id
      }
      // Salvar no banco imediatamente
      await (supabaseAdmin.from('companies') as any)
        .update({ stripe_customer_id: customerId })
        .eq('id', company.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://precyplus.com.br'

    // ── Criar Checkout Session ──
    const checkoutSession = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items:           [{ price: planConfig.price_id, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${appUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/configuracoes?tab=plano`,
      metadata:    { user_id: session.user.id, company_id: company.id, plan },
      subscription_data: {
        trial_period_days: planConfig.trialDays > 0 ? planConfig.trialDays : undefined,
        metadata:          { user_id: session.user.id, company_id: company.id, plan },
      },
      locale: 'pt-BR',
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err: any) {
    console.error('[stripe/checkout]', err?.message ?? err)
    return NextResponse.json({
      error: err?.message ?? 'Erro ao criar sessão de pagamento'
    }, { status: 500 })
  }
}
