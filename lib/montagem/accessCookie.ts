import { signState, verifyState } from '@/lib/catalog/payments/crypto'

/**
 * Cookie de acesso ao Precy Montagem avulso (compra sem conta/senha) —
 * assinado com a mesma chave/HMAC já usada pro `state` do OAuth do Mercado
 * Pago (lib/catalog/payments/crypto.ts), sem precisar de nenhum segredo
 * novo. `signState`/`verifyState` guardam um `ts` interno pra proteger
 * contra violação de conteúdo, mas o controle de validade de verdade é o
 * `expiresAt` gravado no próprio payload (o prazo real da licença, não "há
 * quanto tempo o cookie foi emitido") — por isso a checagem de idade do
 * `verifyState` é passada com uma janela enorme, só pra nunca ser o motivo
 * de recusa.
 */
export const MONTAGEM_ACCESS_COOKIE = 'precy_montagem_access'
const NEVER_STALE_MS = 100 * 365 * 24 * 60 * 60 * 1000

export interface MontagemAccessPayload {
  licenseId: string
  email: string
  expiresAt: string
}

export function signMontagemAccess(payload: MontagemAccessPayload): string {
  // `signState` exige um `ts` numérico no payload (verificado por
  // `verifyState`) — aqui só serve pra satisfazer esse formato; a validade
  // real é o `expiresAt` acima, checado manualmente em `verifyMontagemAccess`.
  return signState({ ...payload, ts: Date.now() })
}

export function verifyMontagemAccess(token: string): MontagemAccessPayload | null {
  const parsed = verifyState(token, NEVER_STALE_MS)
  if (!parsed) return null
  const { licenseId, email, expiresAt } = parsed as Record<string, unknown>
  if (typeof licenseId !== 'string' || typeof email !== 'string' || typeof expiresAt !== 'string') return null
  if (new Date(expiresAt).getTime() < Date.now()) return null
  return { licenseId, email, expiresAt }
}
