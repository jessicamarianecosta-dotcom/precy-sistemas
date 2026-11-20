/**
 * Cliente HTTP fino para a API v3 do Bling, escopo de Notas Fiscais
 * (NF-e). Só roda no servidor (rotas em app/api/notas-fiscais e
 * app/api/bling) — nunca chamado do browser.
 *
 * Schema e endpoints abaixo foram confirmados diretamente contra a
 * referência interativa (developer.bling.com.br/referencia) e o próprio
 * OpenAPI (`openapi-*.json` servido por esse host) em 2026-11-20 — ver
 * lib/notasFiscais/README.md para o detalhe do que foi confirmado assim
 * e o que ainda depende de uma conta Bling real conectada.
 *
 * Confirmado na referência oficial:
 * - Criar a NF-e (POST /nfe) e enviá-la à SEFAZ (POST
 *   /nfe/{id}/enviar) são chamadas SEPARADAS — por isso o fluxo do
 *   módulo nunca dispara o envio junto da criação.
 * - POST /nfe/{id}/enviar não aceita corpo (só o query param opcional
 *   `enviarEmail`) e responde `{ data: { xml: string } }` — NÃO inclui
 *   `situacao`; para saber o status/chave de acesso após enviar, é
 *   preciso um GET /nfe/{id} em seguida (ver consultarNfeNoBling).
 * - O link do DANFE/XML não vem em nenhuma resposta de criação/envio:
 *   é um endpoint à parte, GET /nfe/documento/{chaveAcesso}?formato=pdf|xml,
 *   que devolve o conteúdo em `data[0].conteudo` comprimido com GZIP e
 *   codificado em base64 (não uma URL pronta) — ver obterDocumentoNfe.
 * - `situacao` é um código inteiro (1 Pendente, 2 Cancelada, 3 Aguardando
 *   recibo, 4 Rejeitada, 5 Autorizada, 6 Emitida DANFE, 7 Registrada,
 *   8 Aguardando protocolo, 9 Denegada, 10 Consulta situação,
 *   11 Bloqueada) — nunca uma string livre.
 * - A API do Bling está migrando de tokens opacos para JWT; o header
 *   `enable-jwt: 1` precisa ir tanto na obtenção/renovação do token
 *   (lib/notasFiscais/blingConnection.ts) quanto em toda chamada de
 *   recurso autenticada — ver "Migração para autenticação JWT" na doc.
 */

export const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3'

/** `situacao` da NF-e (NotasFiscaisDadosBaseDTO) — código inteiro confirmado na doc oficial. */
export const SITUACAO_NFE_LABELS: Record<number, string> = {
  1: 'Pendente',
  2: 'Cancelada',
  3: 'Aguardando recibo',
  4: 'Rejeitada',
  5: 'Autorizada',
  6: 'Emitida DANFE',
  7: 'Registrada',
  8: 'Aguardando protocolo',
  9: 'Denegada',
  10: 'Consulta situação',
  11: 'Bloqueada',
}

export class BlingApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Bling API respondeu ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }
}

async function blingRequest(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BLING_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'enable-jwt': '1',
      ...(init?.headers ?? {}),
    },
  })

  const text = await res.text()
  const body = text ? safeJsonParse(text) : null

  if (!res.ok) throw new BlingApiError(res.status, body ?? text)
  return body
}

function safeJsonParse(text: string) {
  try { return JSON.parse(text) } catch { return text }
}

/** POST /nfe — cria a nota como rascunho no Bling. NÃO envia à SEFAZ. */
export async function criarNfeNoBling(accessToken: string, payload: Record<string, unknown>) {
  return blingRequest(accessToken, '/nfe', { method: 'POST', body: JSON.stringify(payload) })
}

/**
 * GET /nfe/{id} — consulta o estado atual de uma nota já criada.
 * Devolve `data.situacao` (código inteiro, ver tabela acima) e, quando
 * já autorizada, `data.chaveAcesso` — é essa chave que alimenta
 * obterDocumentoNfe.
 */
export async function consultarNfeNoBling(accessToken: string, blingInvoiceId: string) {
  return blingRequest(accessToken, `/nfe/${encodeURIComponent(blingInvoiceId)}`, { method: 'GET' })
}

/**
 * POST /nfe/{id}/enviar — envia a nota já criada para autorização na
 * SEFAZ. Única chamada deste cliente que de fato emite a nota de
 * verdade — a rota de API que a usa (app/api/notas-fiscais/[id]/enviar)
 * só roda a partir de um clique explícito da usuária na tela de
 * confirmação, nunca automaticamente. Sem corpo; `enviarEmail` (default
 * false) é o único parâmetro aceito, via query string.
 */
export async function enviarNfeNoBling(accessToken: string, blingInvoiceId: string, enviarEmail = false) {
  return blingRequest(
    accessToken,
    `/nfe/${encodeURIComponent(blingInvoiceId)}/enviar?enviarEmail=${enviarEmail ? 'true' : 'false'}`,
    { method: 'POST' },
  )
}

/**
 * GET /nfe/documento/{chaveAcesso}?formato=pdf|xml — obtém o DANFE (PDF)
 * ou o XML da nota autorizada. O retorno vem em `data[0].conteudo`:
 * base64 de um GZIP do conteúdo real (decodificar base64 e descomprimir
 * GZIP para obter o PDF/XML). Não implementado no fluxo ainda (o módulo
 * hoje só cria rascunho e confirma envio) — função disponível para uso
 * futuro, já no formato correto confirmado na doc oficial.
 */
export async function obterDocumentoNfe(accessToken: string, chaveAcesso: string, formato: 'pdf' | 'xml') {
  return blingRequest(accessToken, `/nfe/documento/${encodeURIComponent(chaveAcesso)}?formato=${formato}`, { method: 'GET' })
}

/**
 * GET /naturezas-operacoes?descricao=... — busca naturezas de operação
 * já cadastradas na conta Bling da empresa, por descrição. A API de NF-e
 * exige `naturezaOperacao` como `{ id }` referenciando um registro já
 * existente na conta — não aceita texto livre (ver fieldMapping.ts).
 */
export async function buscarNaturezasOperacao(accessToken: string, descricao?: string) {
  const qs = descricao ? `?descricao=${encodeURIComponent(descricao)}&situacao=1` : '?situacao=1'
  return blingRequest(accessToken, `/naturezas-operacoes${qs}`, { method: 'GET' })
}
