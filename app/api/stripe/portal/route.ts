import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: company } = await (supabaseAdmin.from('companies') as any)
      .select('stripe_customer_id')
      .eq('user_id', session.user.id)
      .single()

    if (!company?.stripe_customer_id) {
      return NextResponse.json({ error: 'Sem assinatura ativa' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://precyplus.com.br'
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   company.stripe_customer_id,
      return_url: `${appUrl}/configuracoes?tab=plano`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error('[stripe/portal]', err)
    return NextResponse.json({ error: 'Erro ao abrir portal' }, { status: 500 })
  }
}
