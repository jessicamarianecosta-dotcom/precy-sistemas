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
  /*
   * Prioridade: POSTGRES_URL explícita > OLD_DATABASE_URL (conexão do
   * projeto Supabase em produção, ekynvecruqpuwwrcwtnp, enquanto o
   * app continuar gravando tudo lá durante a migração) > heurística
   * de fallback abaixo.
   *
   * A heurística (qualquer env var terminando em _POSTGRES_URL) é
   * frágil de propósito: ela pega a integração nativa Supabase↔Vercel
   * de QUALQUER projeto que esteja conectado no momento. Isso já
   * causou um bug de produção — ao conectar a integração do projeto
   * NOVO (migração), essa heurística passou a resolver pro banco
   * novo (só com um snapshot antigo migrado), enquanto o resto do
   * app (NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY) seguia
   * no banco antigo — os endpoints que usam getPgPool() (upload de
   * arquivo em pedidos/orçamentos) passaram a checar "o pedido
   * existe?" num banco diferente do resto do app, e pedidos/
   * orçamentos criados depois do snapshot voltavam como "não
   * encontrado". Ver conversa com Jessica em 22/09/2026 se precisar
   * do histórico completo.
   */
  const raw =
    process.env.POSTGRES_URL ??
    process.env.OLD_DATABASE_URL ??
    (() => {
      const prefixedKey = Object.keys(process.env).find(
        (key) => key.endsWith('_POSTGRES_URL') && !key.endsWith('_POSTGRES_URL_NON_POOLING')
      )
      return prefixedKey ? process.env[prefixedKey] : undefined
    })()

  if (!raw) {
    throw new Error('Missing POSTGRES_URL — configure a conexão do Postgres no Vercel (integração Supabase).')
  }

  /*
   * O pooler do Supabase inclui `?sslmode=require` na connection string.
   * O pg mescla esse modo com a config `ssl` passada ao Pool e, nessa
   * combinação, acaba validando a cadeia de certificado (que o Node não
   * reconhece nesse pooler) mesmo com rejectUnauthorized:false — por
   * isso removemos o parâmetro daqui e deixamos só a opção `ssl` abaixo
   * decidir o comportamento.
   */
  const url = new URL(raw)
  url.searchParams.delete('sslmode')
  return url.toString()
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
