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
      .select('id, stripe_customer_id, subscription_status, stripe_subscription_id, trial_end')
      .eq('user_id', session.user.id)
      .single()

    if (coErr || !company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://precyplus.com.br'

    // ── Já tem uma assinatura ativa/em trial? Trocar o plano NELA, nunca
    // criar uma segunda assinatura. Antes, um cliente Basic pagante que
    // clicasse em "Assinar Pro" criava uma nova Checkout Session (nova
    // assinatura no Stripe) em vez de trocar a existente — resultando em
    // duas assinaturas simultâneas e cobrança duplicada. ──
    if (company.stripe_subscription_id && ['active', 'trialing'].includes(company.subscription_status)) {
      try {
        const existing = await stripe.subscriptions.retrieve(company.stripe_subscription_id)
        if (existing.status !== 'canceled') {
          const existingPriceId = existing.items.data[0]?.price.id
          if (existingPriceId === planConfig.price_id) {
            return NextResponse.json({ error: 'Você já possui este plano ativo.' }, { status: 409 })
          }
          await stripe.subscriptions.update(company.stripe_subscription_id, {
            items: [{ id: existing.items.data[0].id, price: planConfig.price_id }],
            proration_behavior: 'create_prorations',
            metadata: { user_id: session.user.id, company_id: company.id, plan },
          })
          // customer.subscription.updated (webhook) já atualiza current_plan/
          // subscription_status/current_period_end a partir do novo price_id.
          return NextResponse.json({ url: `${appUrl}/dashboard?planChanged=success` })
        }
      } catch (err: any) {
        console.error('[stripe/checkout] erro ao trocar plano da assinatura existente:', err?.message)
        return NextResponse.json({ error: 'Erro ao trocar de plano. Tente novamente ou use o portal de assinatura.' }, { status: 500 })
      }
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

    // ── Elegibilidade real de trial no Stripe ──
    // PLANS.basic.trialDays é o tamanho do trial INTERNO do app (usado em
    // /api/setup-company para calcular trial_end no cadastro) — nunca deve
    // ser reenviado ao Stripe como "mais 7 dias grátis" sem checar se esse
    // trial já foi concedido/usado. Toda empresa que chega neste endpoint já
    // passou pelo cadastro (setup-company sempre grava trial_end), e a
    // landing page nunca chama checkout diretamente (só /cadastro) — então
    // NUNCA existe um caso legítimo de "primeira vez no Stripe" sem já ter
    // um trial_end interno gravado. Elegível = ainda dentro da janela do
    // trial interno E nunca teve uma assinatura Stripe de verdade (nem em
    // andamento, nem cancelada no passado).
    const trialEndDate = company.trial_end ? new Date(company.trial_end) : null
    const trialStillEligible =
      company.subscription_status === 'trialing' &&
      !company.stripe_subscription_id &&
      !!trialEndDate &&
      trialEndDate.getTime() > Date.now()

    // Stripe exige trial_end pelo menos 48h no futuro (Checkout Session);
    // se o trial interno ainda é válido mas está a menos de 48h do fim,
    // trial_end explícito seria rejeitado pela API — usa trial_period_days=1
    // como piso mínimo aceito, em vez de falhar o checkout de quem ainda
    // está genuinamente dentro do trial.
    const STRIPE_MIN_TRIAL_END_MS = 48 * 60 * 60 * 1000
    const trialCloseToEnding =
      trialStillEligible && trialEndDate!.getTime() - Date.now() < STRIPE_MIN_TRIAL_END_MS

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
        // trial_end (não trial_period_days) sempre que possível, para nunca
        // conceder mais dias do que o trial interno já prometeu — cobrança
        // cai exatamente na data original, não importa em que dia da janela
        // o usuário completa o checkout. Quando NÃO elegível, omite os dois
        // campos por completo (nunca envia trial_period_days=0/undefined
        // "só por enviar") — é isso que faz o Stripe cobrar imediatamente e
        // mostrar "Assinar" em vez de "Iniciar teste".
        ...(trialStillEligible
          ? (trialCloseToEnding
              ? { trial_period_days: 1 }
              : { trial_end: Math.floor(trialEndDate!.getTime() / 1000) })
          : {}),
        metadata: { user_id: session.user.id, company_id: company.id, plan },
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
