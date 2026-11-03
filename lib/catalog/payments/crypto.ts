import crypto from 'crypto'

/**
 * Criptografia simétrica dos tokens OAuth do Mercado Pago gravados em
 * `mercadopago_connections` (access_token_encrypted / refresh_token_encrypted)
 * e assinatura do `state` do fluxo OAuth (CSRF/tamper-proofing, sem precisar
 * de uma tabela de nonces nem de uma dependência de JWT).
 *
 * AES-256-GCM com IV aleatório por chamada — nunca reusar IV com a mesma
 * chave. Formato de saída: "iv:tag:ciphertext" em hex.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const hex = process.env.PAYMENTS_ENCRYPTION_KEY
  if (!hex) throw new Error('PAYMENTS_ENCRYPTION_KEY não configurada')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) throw new Error('PAYMENTS_ENCRYPTION_KEY deve ter 32 bytes (64 caracteres hex)')
  return key
}

export function encrypt(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decrypt(payload: string): string {
  const key = getKey()
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Formato inválido de dado cifrado')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()])
  return plaintext.toString('utf8')
}

/**
 * State assinado do fluxo OAuth do Mercado Pago — amarra o callback ao
 * company_id de quem iniciou a conexão (nunca confiar em company_id vindo
 * só da query string do callback) e expira sozinho, sem precisar de
 * cookie/tabela de nonce. A chave de assinatura é derivada da chave de
 * criptografia (nunca a mesma chave usada para cifrar os tokens).
 */
function getStateKey(): Buffer {
  return crypto.createHash('sha256').update(Buffer.concat([getKey(), Buffer.from('mp-oauth-state')])).digest()
}

export function signState(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', getStateKey()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyState(state: string, maxAgeMs = 10 * 60 * 1000): Record<string, unknown> | null {
  const [body, sig] = state.split('.')
  if (!body || !sig) return null

  const expectedSig = crypto.createHmac('sha256', getStateKey()).update(body).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > maxAgeMs) return null
    return parsed
  } catch {
    return null
  }
}
