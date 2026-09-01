import type { CnpjData } from '@/lib/services/cnpj'

// ⚠️ Uso exclusivo do servidor — importe apenas em rotas /api. Não contém
// segredos, mas fala direto com provedores externos (sem passar por CORS).

/**
 * Provedores de dados públicos de CNPJ do Precy+ (uso exclusivo do servidor).
 *
 * Motivação: a consulta de CNPJ vinha falhando em produção com a mensagem
 * genérica "Não foi possível consultar o CNPJ agora". A causa era a rota
 * `/api/cnpj` depender de um único provedor (BrasilAPI) SEM timeout e SEM
 * fallback — quando a BrasilAPI respondia lento, com 429 (limite dos IPs
 * compartilhados da Vercel) ou 5xx, a função caía no catch e devolvia o erro
 * genérico.
 *
 * Aqui consultamos, em sequência, três fontes públicas gratuitas (sem chave):
 *   1. BrasilAPI        — https://brasilapi.com.br/api/cnpj/v1/:cnpj
 *   2. ReceitaWS        — https://receitaws.com.br/v1/cnpj/:cnpj
 *   3. CNPJ.ws (público)— https://publica.cnpj.ws/cnpj/:cnpj
 *
 * A primeira que responder com dados válidos vence. Se qualquer provedor
 * afirmar com certeza que o CNPJ não existe, paramos e retornamos "not_found".
 * Cada chamada tem timeout próprio para nunca travar a função serverless.
 */

const PROVIDER_TIMEOUT_MS = 7000

export type ProviderResult =
  | { outcome: 'ok'; data: CnpjData; provider: string }
  | { outcome: 'not_found'; provider: string }
  | { outcome: 'timeout'; provider: string }
  | { outcome: 'error'; provider: string; detail: string }

interface Provider {
  name: string
  fetch: (cnpj: string, signal: AbortSignal) => Promise<ProviderResult>
}

export async function lookupCnpjFromProviders(cnpj: string): Promise<ProviderResult> {
  let lastFailure: ProviderResult | null = null

  for (const provider of PROVIDERS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
    let result: ProviderResult
    try {
      result = await provider.fetch(cnpj, controller.signal)
    } catch (err) {
      const aborted = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')
      result = aborted
        ? { outcome: 'timeout', provider: provider.name }
        : { outcome: 'error', provider: provider.name, detail: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(timer)
    }

    if (result.outcome === 'ok') return result
    if (result.outcome === 'not_found') return result

    console.warn(`[cnpj] provedor ${provider.name} falhou:`, result)
    lastFailure = result
  }

  return lastFailure ?? { outcome: 'error', provider: 'nenhum', detail: 'sem provedores' }
}

/* ────────────────────────────────────────────────────────────────────────── */

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function digits(v: unknown): string | null {
  const s = str(v)
  return s ? s.replace(/\D/g, '') || null : null
}

function joinLogradouro(tipo: unknown, logradouro: unknown): string | null {
  const t = str(tipo)
  const l = str(logradouro)
  if (!l) return null
  // Evita duplicar "RUA RUA ..." quando o logradouro já vem com o tipo.
  if (t && l.toUpperCase().startsWith(t.toUpperCase())) return l
  return t ? `${t} ${l}` : l
}

/* ── 1. BrasilAPI ─────────────────────────────────────────────────────────── */

async function fromBrasilApi(cnpj: string, signal: AbortSignal): Promise<ProviderResult> {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  if (res.status === 404) return { outcome: 'not_found', provider: 'brasilapi' }
  if (!res.ok) return { outcome: 'error', provider: 'brasilapi', detail: `HTTP ${res.status}` }

  const raw = await res.json().catch(() => null)
  if (!raw || typeof raw !== 'object') {
    return { outcome: 'error', provider: 'brasilapi', detail: 'resposta inválida' }
  }

  const data: CnpjData = {
    cnpj: digits(raw.cnpj) ?? cnpj,
    razaoSocial: str(raw.razao_social),
    nomeFantasia: str(raw.nome_fantasia),
    situacaoCadastral: str(raw.descricao_situacao_cadastral),
    dataAbertura: str(raw.data_inicio_atividade),
    cnae: raw.cnae_fiscal != null ? String(raw.cnae_fiscal) : null,
    cnaeDescricao: str(raw.cnae_fiscal_descricao),
    telefone: str(raw.ddd_telefone_1),
    email: str(raw.email),
    cep: digits(raw.cep),
    logradouro: joinLogradouro(raw.descricao_tipo_de_logradouro, raw.logradouro),
    numero: str(raw.numero),
    complemento: str(raw.complemento),
    bairro: str(raw.bairro),
    cidade: str(raw.municipio),
    uf: str(raw.uf),
  }

  if (!data.razaoSocial) return { outcome: 'error', provider: 'brasilapi', detail: 'sem razão social' }
  return { outcome: 'ok', data, provider: 'brasilapi' }
}

/* ── 2. ReceitaWS ─────────────────────────────────────────────────────────── */

async function fromReceitaWs(cnpj: string, signal: AbortSignal): Promise<ProviderResult> {
  const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  if (res.status === 404) return { outcome: 'not_found', provider: 'receitaws' }
  if (res.status === 429) return { outcome: 'error', provider: 'receitaws', detail: 'HTTP 429 (limite)' }
  if (!res.ok) return { outcome: 'error', provider: 'receitaws', detail: `HTTP ${res.status}` }

  const raw = await res.json().catch(() => null)
  if (!raw || typeof raw !== 'object') {
    return { outcome: 'error', provider: 'receitaws', detail: 'resposta inválida' }
  }
  if (raw.status === 'ERROR') {
    const msg = String(raw.message ?? '').toLowerCase()
    if (msg.includes('não encontr') || msg.includes('nao encontr')) {
      return { outcome: 'not_found', provider: 'receitaws' }
    }
    return { outcome: 'error', provider: 'receitaws', detail: str(raw.message) ?? 'ERROR' }
  }

  const atividade = Array.isArray(raw.atividade_principal) ? raw.atividade_principal[0] : null

  const data: CnpjData = {
    cnpj: digits(raw.cnpj) ?? cnpj,
    razaoSocial: str(raw.nome),
    nomeFantasia: str(raw.fantasia),
    situacaoCadastral: str(raw.situacao),
    dataAbertura: str(raw.abertura),
    cnae: atividade ? digits(atividade.code) : null,
    cnaeDescricao: atividade ? str(atividade.text) : null,
    telefone: str(raw.telefone),
    email: str(raw.email),
    cep: digits(raw.cep),
    logradouro: str(raw.logradouro),
    numero: str(raw.numero),
    complemento: str(raw.complemento),
    bairro: str(raw.bairro),
    cidade: str(raw.municipio),
    uf: str(raw.uf),
  }

  if (!data.razaoSocial) return { outcome: 'error', provider: 'receitaws', detail: 'sem razão social' }
  return { outcome: 'ok', data, provider: 'receitaws' }
}

/* ── 3. CNPJ.ws (endpoint público) ───────────────────────────────────────── */

async function fromCnpjWs(cnpj: string, signal: AbortSignal): Promise<ProviderResult> {
  const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  if (res.status === 404) return { outcome: 'not_found', provider: 'cnpj.ws' }
  if (res.status === 429) return { outcome: 'error', provider: 'cnpj.ws', detail: 'HTTP 429 (limite)' }
  if (!res.ok) return { outcome: 'error', provider: 'cnpj.ws', detail: `HTTP ${res.status}` }

  const raw = await res.json().catch(() => null)
  if (!raw || typeof raw !== 'object') {
    return { outcome: 'error', provider: 'cnpj.ws', detail: 'resposta inválida' }
  }

  const est = raw.estabelecimento && typeof raw.estabelecimento === 'object' ? raw.estabelecimento : {}
  const atividade = est.atividade_principal && typeof est.atividade_principal === 'object' ? est.atividade_principal : null
  const ddd = str(est.ddd1)
  const fone = str(est.telefone1)

  const data: CnpjData = {
    cnpj: digits(est.cnpj) ?? digits(cnpj) ?? cnpj,
    razaoSocial: str(raw.razao_social),
    nomeFantasia: str(est.nome_fantasia),
    situacaoCadastral: str(est.situacao_cadastral),
    dataAbertura: str(est.data_inicio_atividade),
    cnae: atividade ? digits(atividade.id ?? atividade.subclasse) : null,
    cnaeDescricao: atividade ? str(atividade.descricao) : null,
    telefone: ddd && fone ? `(${ddd}) ${fone}` : fone,
    email: str(est.email),
    cep: digits(est.cep),
    logradouro: joinLogradouro(est.tipo_logradouro, est.logradouro),
    numero: str(est.numero),
    complemento: str(est.complemento),
    bairro: str(est.bairro),
    cidade: str(est.cidade?.nome),
    uf: str(est.estado?.sigla),
  }

  if (!data.razaoSocial) return { outcome: 'error', provider: 'cnpj.ws', detail: 'sem razão social' }
  return { outcome: 'ok', data, provider: 'cnpj.ws' }
}

const PROVIDERS: Provider[] = [
  { name: 'brasilapi', fetch: fromBrasilApi },
  { name: 'receitaws', fetch: fromReceitaWs },
  { name: 'cnpj.ws', fetch: fromCnpjWs },
]
