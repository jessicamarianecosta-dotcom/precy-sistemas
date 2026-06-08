import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_PLANS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { plan } = await req.json()

    const planConfig =
      STRIPE_PLANS[
        plan as keyof typeof STRIPE_PLANS
      ]

    if (!planConfig) {
      return NextResponse.json(
        { error: 'Plano inválido' },
        { status: 400 }
      )
    }

    const response: any = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', session.user.id)
      .single()

    const subscription = response?.data

    let customerId =
      subscription?.stripe_customer_id

    if (!customerId) {
      const customer =
        await stripe.customers.create({
          email: session.user.email,

          metadata: {
            user_id: session.user.id,
          },
        })

      customerId = customer.id

      await (
        supabase.from(
          'subscriptions'
        ) as any
      )
        .update({
          stripe_customer_id:
            customerId,
        })
        .eq(
          'user_id',
          session.user.id
        )
    }

    const checkoutSession =
      await stripe.checkout.sessions.create(
        {
          customer: customerId,

          mode: 'subscription',

          payment_method_types: [
            'card',
          ],

          line_items: [
            {
              price:
                planConfig.price_id,

              quantity: 1,
            },
          ],

          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,

          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?tab=plano`,

          metadata: {
            user_id:
              session.user.id,

            plan: plan,
          },

          subscription_data: {
            metadata: {
              user_id:
                session.user.id,
            },
          },
        }
      )

    return NextResponse.json({
      url: checkoutSession.url,
    })
  } catch (error) {
    console.error(
      'Stripe checkout error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Erro ao criar sessão de pagamento',
      },
      { status: 500 }
    )
  }
}
