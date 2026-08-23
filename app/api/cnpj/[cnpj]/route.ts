import { NextResponse } from 'next/server'
import type { CnpjData } from '@/lib/services/cnpj'

/**
 * GET /api/cnpj/:cnpj
 * Proxy interno para a BrasilAPI — o frontend nunca fala com a BrasilAPI
 * diretamente. Gratuita, sem API key, sem cadastro. Mantém a integração
 * isolada aqui para facilitar troca de fornecedor de dados no futuro.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj: raw } = await params
  const cnpj = String(raw ?? '').replace(/\D/g, '')

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'Digite um CNPJ válido com 14 dígitos.' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[api/cnpj] falha de rede ao consultar BrasilAPI:', err)
    return NextResponse.json({ error: 'Não foi possível consultar o CNPJ agora.' }, { status: 502 })
  }

  if (res.status === 404) {
    return NextResponse.json({ error: 'CNPJ não encontrado.' }, { status: 404 })
  }
  if (!res.ok) {
    console.error('[api/cnpj] BrasilAPI retornou status inesperado:', res.status)
    return NextResponse.json({ error: 'Não foi possível consultar o CNPJ agora.' }, { status: 502 })
  }

  const raw_ = await res.json().catch(() => null)
  if (!raw_ || typeof raw_ !== 'object') {
    return NextResponse.json({ error: 'Não foi possível consultar o CNPJ agora.' }, { status: 502 })
  }

  const data: CnpjData = {
    cnpj: str(raw_.cnpj) ?? cnpj,
    razaoSocial: str(raw_.razao_social),
    nomeFantasia: str(raw_.nome_fantasia),
    situacaoCadastral: str(raw_.descricao_situacao_cadastral),
    dataAbertura: str(raw_.data_inicio_atividade),
    cnae: raw_.cnae_fiscal != null ? String(raw_.cnae_fiscal) : null,
    cnaeDescricao: str(raw_.cnae_fiscal_descricao),
    telefone: buildPhone(raw_.ddd_telefone_1),
    email: str(raw_.email),
    cep: raw_.cep != null ? String(raw_.cep).replace(/\D/g, '') : null,
    logradouro: buildLogradouro(raw_.descricao_tipo_de_logradouro, raw_.logradouro),
    numero: str(raw_.numero),
    complemento: str(raw_.complemento),
    bairro: str(raw_.bairro),
    cidade: str(raw_.municipio),
    uf: str(raw_.uf),
  }

  return NextResponse.json({ data })
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function buildPhone(ddDTelefone: unknown): string | null {
  const s = str(ddDTelefone)
  return s
}

function buildLogradouro(tipo: unknown, logradouro: unknown): string | null {
  const t = str(tipo)
  const l = str(logradouro)
  if (!l) return null
  return t ? `${t} ${l}` : l
}
