import { onlyDigits, isValidCnpjLength } from '@/lib/utils/mask'

/**
 * Serviço de consulta de CNPJ do Precy+.
 * O client NUNCA fala direto com a BrasilAPI — sempre via `/api/cnpj/:cnpj`,
 * para não expor a integração externa no frontend e permitir trocar de
 * fornecedor de dados no futuro sem tocar nos formulários.
 */

export interface CnpjData {
  cnpj: string
  razaoSocial: string | null
  nomeFantasia: string | null
  situacaoCadastral: string | null
  dataAbertura: string | null
  cnae: string | null
  cnaeDescricao: string | null
  telefone: string | null
  email: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}

export type CnpjLookupResult =
  | { ok: true; data: CnpjData }
  | { ok: false; status: 'invalid' | 'not_found' | 'timeout' | 'unavailable'; message: string }

export function normalizeCnpj(value: string): string {
  return onlyDigits(value)
}

export { isValidCnpjLength }

/** Consulta o CNPJ via rota interna do Precy+ (`/api/cnpj/:cnpj`). Nunca lança — sempre retorna um resultado tipado. */
export async function fetchCnpjData(rawCnpj: string): Promise<CnpjLookupResult> {
  const cnpj = normalizeCnpj(rawCnpj)
  if (!isValidCnpjLength(cnpj)) {
    return { ok: false, status: 'invalid', message: 'Digite um CNPJ válido com 14 dígitos.' }
  }

  try {
    const res = await fetch(`/api/cnpj/${cnpj}`, { method: 'GET' })
    const body = await res.json().catch(() => null)

    if (res.status === 404) {
      return { ok: false, status: 'not_found', message: 'CNPJ não encontrado. Confira o número e tente novamente.' }
    }
    if (res.status === 400) {
      return { ok: false, status: 'invalid', message: body?.error ?? 'Digite um CNPJ válido. Verifique os números informados.' }
    }
    if (res.status === 504 || body?.code === 'timeout') {
      return { ok: false, status: 'timeout', message: 'A consulta de CNPJ demorou demais. Tente novamente em instantes.' }
    }
    if (!res.ok || !body?.data) {
      return { ok: false, status: 'unavailable', message: 'Não foi possível consultar o CNPJ no momento. Tente novamente ou preencha os dados manualmente.' }
    }

    return { ok: true, data: body.data as CnpjData }
  } catch {
    return { ok: false, status: 'unavailable', message: 'Não foi possível consultar o CNPJ no momento. Tente novamente ou preencha os dados manualmente.' }
  }
}
