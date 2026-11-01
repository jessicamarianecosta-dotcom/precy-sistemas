import crypto from 'crypto'

/**
 * Criptografia simétrica (AES-256-GCM) dos tokens OAuth de cada loja antes
 * de gravar em store_payment_accounts — nenhuma credencial financeira fica
 * em texto puro no banco, e muito menos chega ao frontend (essas colunas
 * nunca são selecionadas por uma rota pública).
 *
 * PAYMENTS_ENCRYPTION_KEY: string de 32+ bytes (ex.: `openssl rand -hex 32`),
 * exclusiva deste uso — nunca reaproveitar uma chave do Stripe/Supabase.
 */
function getKey(): Buffer {
  const secret = process.env.PAYMENTS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('PAYMENTS_ENCRYPTION_KEY não configurada — necessária para armazenar credenciais de pagamento de forma segura.')
  }
  // Aceita tanto hex (64 chars = 32 bytes) quanto qualquer string: normaliza
  // via SHA-256 para sempre obter os 32 bytes exigidos pelo AES-256.
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptToken(plainText: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.')
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Token criptografado em formato inválido')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
