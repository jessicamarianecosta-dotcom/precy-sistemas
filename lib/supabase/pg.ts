import { Pool } from 'pg'

/*
 * Conexão direta ao Postgres do Supabase, sem passar pelo gateway
 * REST/PostgREST (Kong) que exige a `service_role`/`secret` API key.
 * A Vercel cria essas variáveis automaticamente ao conectar a
 * integração oficial Supabase↔Vercel — não são digitadas manualmente,
 * então não sofrem do mesmo erro de transcrição que a API key teve.
 *
 * Aceita tanto o nome padrão quanto o nome prefixado com o project ref
 * que a integração usa (ex.: `<ref>_POSTGRES_URL`), procurando por
 * qualquer variável de ambiente que termine em POSTGRES_URL.
 */
function resolveConnectionString(): string {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL

  const prefixedKey = Object.keys(process.env).find(
    (key) => key.endsWith('_POSTGRES_URL') && !key.endsWith('_POSTGRES_URL_NON_POOLING')
  )
  if (prefixedKey && process.env[prefixedKey]) return process.env[prefixedKey] as string

  throw new Error('Missing POSTGRES_URL — configure a conexão do Postgres no Vercel (integração Supabase).')
}

let pool: Pool | null = null

export function getPgPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: resolveConnectionString(),
      ssl: { rejectUnauthorized: false },
      max: 1,
    })
  }
  return pool
}
