import { NextResponse } from 'next/server'
import type { CepData } from '@/lib/services/cep'

/**
 * GET /api/cep/:cep
 * Proxy interno para o ViaCEP — mesma razão do /api/cnpj: manter a
 * integração externa fora do frontend.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ cep: string }> }) {
  const { cep: raw } = await params
  const cep = String(raw ?? '').replace(/\D/g, '')

  if (cep.length !== 8) {
    return NextResponse.json({ error: 'Digite um CEP válido.' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[api/cep] falha de rede ao consultar ViaCEP:', err)
    return NextResponse.json({ error: 'Não foi possível consultar o CEP agora.' }, { status: 502 })
  }

  if (!res.ok) {
    console.error('[api/cep] ViaCEP retornou status inesperado:', res.status)
    return NextResponse.json({ error: 'Não foi possível consultar o CEP agora.' }, { status: 502 })
  }

  const raw_ = await res.json().catch(() => null)
  if (!raw_ || typeof raw_ !== 'object' || raw_.erro) {
    return NextResponse.json({ error: 'CEP não encontrado.' }, { status: 404 })
  }

  const data: CepData = {
    cep,
    logradouro: str(raw_.logradouro),
    bairro: str(raw_.bairro),
    cidade: str(raw_.localidade),
    uf: str(raw_.uf),
    ibge: str(raw_.ibge),
  }

  return NextResponse.json({ data })
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}
