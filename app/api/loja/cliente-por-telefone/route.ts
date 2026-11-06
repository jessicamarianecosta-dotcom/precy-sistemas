import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveStoreCompanyId } from '@/lib/catalog/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * GET /api/loja/cliente-por-telefone?slug=&phone=
 *
 * Rota pública (visitante anônimo da loja) usada na Etapa 1 do checkout
 * para pré-preencher os dados de quem já é cliente dessa empresa — "Se o
 * cliente já estiver cadastrado, preencher automaticamente seus dados"
 * (o cliente pode sempre alterar, nunca é travado). Busca só pelo telefone
 * EXATO que o próprio visitante digitou, dentro da empresa da loja — nunca
 * lista clientes, nunca aceita busca parcial.
 */
export async function GET(request: Request) {
  if (!checkRateLimit(`loja-cliente-telefone:${getClientIp(request)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' }, { status: 429 })
  }

  const url = new URL(request.url)
  const slug = String(url.searchParams.get('slug') ?? '')
  const phone = String(url.searchParams.get('phone') ?? '').replace(/\D/g, '')

  if (!slug || phone.length < 10) {
    return NextResponse.json({ customer: null })
  }

  const companyId = await resolveStoreCompanyId(slug)
  if (!companyId) {
    return NextResponse.json({ customer: null })
  }

  const { data } = await (supabaseAdmin.from('customers') as any)
    .select('name, email, cpf_cnpj, address, city, state')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .maybeSingle()

  if (!data) return NextResponse.json({ customer: null })

  return NextResponse.json({
    customer: {
      name: data.name ?? '',
      email: data.email ?? '',
      cpfCnpj: data.cpf_cnpj ?? '',
      city: data.city ?? '',
      state: data.state ?? '',
    },
  })
}
