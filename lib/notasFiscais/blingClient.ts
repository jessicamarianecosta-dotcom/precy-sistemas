/**
 * Cliente HTTP fino para a API v3 do Bling, escopo de Notas Fiscais
 * (NF-e). Só roda no servidor (rotas em app/api/notas-fiscais e
 * app/api/bling) — nunca chamado do browser.
 *
 * IMPORTANTE (ver lib/notasFiscais/README.md): não foi possível alcançar
 * developer.bling.com.br nesta sessão de implementação para confirmar o
 * schema exato campo a campo contra a doc oficial/OpenAPI — os nomes de
 * endpoint e dos campos abaixo vêm do changelog oficial do Bling e de
 * guias técnicos de parceiros (Koncili, Nango), encontrados por busca,
 * não da referência primária. Antes de ligar emissão real, confirme isso
 * contra uma conta Bling de teste conectada (a resposta de erro do Bling
 * é sempre devolvida crua pra UI, nunca escondida, exatamente pra isso).
 *
 * Confirmado no changelog oficial: criar a NF-e (POST /nfe) e enviá-la à
 * SEFAZ (POST /nfe/{id}/enviar) são chamadas SEPARADAS — por isso o fluxo
 * do módulo nunca dispara o envio junto da criação.
 */

export const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3'

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

/** GET /nfe/{id} — consulta o estado atual de uma nota já criada. */
export async function consultarNfeNoBling(accessToken: string, blingInvoiceId: string) {
  return blingRequest(accessToken, `/nfe/${encodeURIComponent(blingInvoiceId)}`, { method: 'GET' })
}

/**
 * POST /nfe/{id}/enviar — envia a nota já criada para autorização na
 * SEFAZ. Única chamada deste cliente que de fato emite a nota de
 * verdade — a rota de API que a usa (app/api/notas-fiscais/[id]/enviar)
 * só roda a partir de um clique explícito da usuária na tela de
 * confirmação, nunca automaticamente.
 */
export async function enviarNfeNoBling(accessToken: string, blingInvoiceId: string) {
  return blingRequest(accessToken, `/nfe/${encodeURIComponent(blingInvoiceId)}/enviar`, { method: 'POST' })
}
