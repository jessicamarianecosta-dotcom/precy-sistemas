import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { MONTAGEM_ACCESS_COOKIE, signMontagemAccess } from '@/lib/montagem/accessCookie'

export const runtime = 'nodejs'

/**
 * GET /api/montagem/confirmar?ref=<licenseId>
 *
 * Chamada pela página de retorno do pagamento (app/montagem/retorno) — olha
 * o status real da licença no banco (nunca confia no retorno do gateway na
 * URL) e, só se já estiver 'approved' pelo webhook, libera o cookie de
 * acesso. Se o webhook ainda não chegou, devolve 'pending' pra página
 * continuar tentando de novo em alguns segundos.
 */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('ref')
  if (!ref) return NextResponse.json({ error: 'Parâmetro ref ausente.' }, { status: 400 })

  const { data: license, error } = await (supabaseAdmin.from('montagem_licenses') as any)
    .select('id, email, status, expires_at')
    .eq('id', ref)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Falha ao consultar o pagamento.' }, { status: 500 })
  if (!license) return NextResponse.json({ status: 'not_found' }, { status: 404 })

  if (license.status !== 'approved') {
    return NextResponse.json({ status: license.status })
  }

  const token = signMontagemAccess({
    licenseId: license.id,
    email: license.email,
    expiresAt: license.expires_at,
  })

  const res = NextResponse.json({ status: 'approved' })
  res.cookies.set(MONTAGEM_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(license.expires_at),
  })
  return res
}
