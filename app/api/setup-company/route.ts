import { NextResponse, NextRequest }  from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies }                  from 'next/headers'
import { supabaseAdmin }            from '@/lib/supabase/admin'
import { PLANS }                    from '@/lib/stripe/plans'
import {
  DEVICE_ID_COOKIE, getOrCreateDeviceId, hashIp, isTrialAbusive, recordTrialFingerprint,
} from '@/lib/trial/antiAbuse'

/**
 * POST /api/setup-company
 * Garante que o usuário autenticado tem uma empresa.
 * Usa supabaseAdmin (service role) para bypassar RLS.
 */
export async function POST(request: NextRequest) {
  try {
    // Pegar usuário pela sessão server-side
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user }, error: userError } = await serverClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // device_id: cookie httpOnly de primeira parte usado para antiabuso de
    // trial (ver lib/trial/antiAbuse.ts) — precisa ser lido/gerado antes de
    // qualquer return, para ser sempre gravado na resposta.
    const cookieStore = await cookies()
    const { deviceId, isNew: isNewDevice } = getOrCreateDeviceId(cookieStore.get(DEVICE_ID_COOKIE)?.value)

    function withDeviceCookie(res: NextResponse) {
      if (isNewDevice) {
        res.cookies.set(DEVICE_ID_COOKIE, deviceId, {
          httpOnly: true, secure: true, sameSite: 'lax', path: '/',
          maxAge: 60 * 60 * 24 * 365,
        })
      }
      return res
    }

    // Verificar se já tem empresa (usando admin para evitar problemas de RLS)
    const { data: existing } = await (supabaseAdmin as any).from('companies').select('id, name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing?.id) {
      return withDeviceCookie(NextResponse.json({ companyId: existing.id, created: false }))
    }

    // Buscar profile para pegar nome
    const { data: profile } = await (supabaseAdmin as any).from('profiles').select('name, email')
      .eq('id', user.id)
      .maybeSingle()

    // Criar empresa com admin (bypassa RLS)
    const companyName =
      (user.user_metadata?.company_name as string) ||
      (profile?.name as string) ||
      user.email?.split('@')[0] ||
      'Meu Negócio'

    // Antiabuso: mesmo device_id ou IP já usado para um trial recente ->
    // não ganha o bônus de 7 dias PRO de novo (evita o vetor "trocar só o
    // e-mail" para trial infinito). A conta é criada normalmente de
    // qualquer forma — só o bônus de trial é negado, nunca o acesso ao
    // produto em si.
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const ipHash = hashIp(ip)
    const abusive = await isTrialAbusive(deviceId, ipHash)

    const trialEnd = abusive
      ? new Date().toISOString() // trial já "usado" — sem bônus, cai direto no Basic normal
      : new Date(Date.now() + PLANS.basic.trialDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: company, error: createError } = await (supabaseAdmin as any).from('companies').insert({
        user_id:              user.id,
        name:                 companyName,
        email:                user.email ?? '',
        work_hours_per_month: 160,
        fixed_costs:          0,
        currency:             'BRL',
        timezone:             'America/Sao_Paulo',
        current_plan:         'basic',
        subscription_status:  'trialing',
        trial_end:            trialEnd,
      })
      .select('id')
      .single()

    if (createError) {
      console.error('[setup-company] create error:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    await recordTrialFingerprint({
      deviceId, ipHash, companyId: company.id, userId: user.id, granted: !abusive,
    })

    return withDeviceCookie(NextResponse.json({ companyId: company.id, created: true }))
  } catch (err) {
    console.error('[setup-company] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
