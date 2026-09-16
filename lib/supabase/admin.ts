import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

/*
 * Diagnóstico temporário para o Digest 1703337547 ("Invalid API key").
 * Não expõe a chave — só confirma formato/tamanho/payload do JWT nos logs
 * do servidor, pra descobrir por que o valor salvo na Vercel está sendo
 * rejeitado mesmo depois de recolado do Supabase. Remover depois de
 * confirmado o causador real.
 */
try {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY
  const trimmed = raw.trim()
  const parts = trimmed.split('.')
  let payloadInfo: unknown = null
  if (parts.length === 3) {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    payloadInfo = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  }
  console.log('[supabaseAdmin diag]', {
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    hasLeadingOrTrailingWhitespace: raw !== trimmed,
    hasNewline: /[\r\n]/.test(raw),
    segments: parts.length,
    first8: trimmed.slice(0, 8),
    last8: trimmed.slice(-8),
    jwtPayload: payloadInfo,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
} catch (diagErr) {
  console.log('[supabaseAdmin diag] failed to introspect key:', diagErr)
}

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
