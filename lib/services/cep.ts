import { onlyDigits, isValidCepLength } from '@/lib/utils/mask'

/**
 * Serviço de consulta de CEP do Precy+.
 * Mesma arquitetura do serviço de CNPJ: o client fala só com `/api/cep/:cep`,
 * que por sua vez consulta o ViaCEP no servidor.
 */

export interface CepData {
  cep: string
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  ibge: string | null
}

export type CepLookupResult =
  | { ok: true; data: CepData }
  | { ok: false; status: 'invalid' | 'not_found' | 'unavailable'; message: string }

export function normalizeCep(value: string): string {
  return onlyDigits(value)
}

export { isValidCepLength }

/** Consulta o CEP via rota interna do Precy+ (`/api/cep/:cep`). Nunca lança — sempre retorna um resultado tipado. */
export async function fetchCepData(rawCep: string): Promise<CepLookupResult> {
  const cep = normalizeCep(rawCep)
  if (!isValidCepLength(cep)) {
    return { ok: false, status: 'invalid', message: 'Digite um CEP válido.' }
  }

  try {
    const res = await fetch(`/api/cep/${cep}`, { method: 'GET' })
    const body = await res.json().catch(() => null)

    if (res.status === 404) {
      return { ok: false, status: 'not_found', message: 'CEP não encontrado. Confira o número.' }
    }
    if (res.status === 400) {
      return { ok: false, status: 'invalid', message: body?.error ?? 'Digite um CEP válido.' }
    }
    if (!res.ok || !body?.data) {
      return { ok: false, status: 'unavailable', message: 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.' }
    }

    return { ok: true, data: body.data as CepData }
  } catch {
    return { ok: false, status: 'unavailable', message: 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.' }
  }
}
