import { NextResponse } from 'next/server'
import { lookupCnpjFromProviders } from '@/lib/services/cnpjProviders'

/**
 * GET /api/cnpj/:cnpj
 *
 * Proxy interno de consulta de CNPJ — o frontend nunca fala com provedores
 * externos diretamente (evita CORS, esconde a integração e permite trocar de
 * fonte sem tocar nos formulários).
 *
 * A consulta tenta múltiplas fontes públicas em sequência (BrasilAPI →
 * ReceitaWS → CNPJ.ws), cada uma com timeout próprio. Retorna sempre um JSON
 * com `{ data }` em caso de sucesso ou `{ error, code }` em caso de falha,
 * com o status HTTP adequado para o frontend distinguir os cenários.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(_request: Request, { params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj: raw } = await params
  const cnpj = String(raw ?? '').replace(/\D/g, '')

  if (cnpj.length !== 14) {
    return NextResponse.json(
      { error: 'Digite um CNPJ válido com 14 dígitos.', code: 'invalid' },
      { status: 400 },
    )
  }

  const result = await lookupCnpjFromProviders(cnpj)

  switch (result.outcome) {
    case 'ok':
      return NextResponse.json(
        { data: result.data, provider: result.provider },
        { status: 200, headers: { 'Cache-Control': 'private, max-age=86400' } },
      )

    case 'not_found':
      return NextResponse.json({ error: 'CNPJ não encontrado.', code: 'not_found' }, { status: 404 })

    case 'timeout':
      console.error('[api/cnpj] todas as fontes esgotaram o tempo limite')
      return NextResponse.json(
        { error: 'A consulta de CNPJ demorou demais. Tente novamente em instantes.', code: 'timeout' },
        { status: 504 },
      )

    default:
      console.error('[api/cnpj] todas as fontes falharam:', result)
      return NextResponse.json(
        { error: 'Não foi possível consultar o CNPJ no momento. Tente novamente.', code: 'unavailable' },
        { status: 502 },
      )
  }
}
