import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Pool } from 'pg'
import { getPgPool } from '@/lib/supabase/pg'

const ADMIN_EMAIL = 'jessicamarianecosta@gmail.com'

/**
 * GET /api/admin/migrate-old-db?mode=inspect|migrate
 *
 * Ferramenta temporária, admin-only, para completar a migração de dados
 * do projeto Supabase antigo (ekynvecruqpuwwrcwtnp, via OLD_DATABASE_URL)
 * para o novo (xtisgwnxvyygtswlldvi, via POSTGRES_URL) que ficou pela
 * metade em uma sessão anterior — só copiou companies/profiles/products.
 *
 * mode=inspect (padrão): só lê e compara contagem de linhas nos dois
 * bancos, não escreve nada. Use isso primeiro.
 *
 * mode=migrate: copia de fato — INSERT ... ON CONFLICT DO NOTHING linha
 * por linha, tabela por tabela, em múltiplas passadas (pra lidar com
 * dependência de FK sem precisar ordenar manualmente 80+ tabelas). Nunca
 * apaga nem sobrescreve nada no banco novo, e nunca toca no banco antigo.
 *
 * Remover esta rota depois que a migração for confirmada.
 */
export async function GET(request: Request) {
  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  if (!process.env.OLD_DATABASE_URL) {
    return NextResponse.json({ error: 'Missing OLD_DATABASE_URL' }, { status: 500 })
  }

  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') === 'migrate' ? 'migrate' : 'inspect'

  const sourcePool = new Pool({
    connectionString: process.env.OLD_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  })
  const targetPool = getPgPool()

  try {
    const { rows: tables } = await sourcePool.query<{ table_name: string }>(`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `)

    const results: Record<string, any> = {}
    const pending = new Set(tables.map((t) => t.table_name))
    const MAX_PASSES = 6

    for (let pass = 1; pass <= MAX_PASSES && pending.size > 0; pass++) {
      for (const tableName of Array.from(pending)) {
        try {
          const { rows: srcCountRows } = await sourcePool.query(
            `select count(*)::int as c from public.${quoteIdent(tableName)}`
          )
          const sourceCount = srcCountRows[0].c

          if (mode === 'inspect') {
            const { rows: tgtCountRows } = await targetPool.query(
              `select count(*)::int as c from public.${quoteIdent(tableName)}`
            ).catch(() => ({ rows: [{ c: null }] }))
            results[tableName] = { sourceCount, targetCount: tgtCountRows[0].c }
            pending.delete(tableName)
            continue
          }

          if (sourceCount === 0) {
            results[tableName] = { sourceCount, inserted: 0 }
            pending.delete(tableName)
            continue
          }

          // Colunas em comum entre origem e destino (schema deve ser igual,
          // mas confere mesmo assim por segurança)
          const cols = await commonColumns(sourcePool, targetPool, tableName)
          if (cols.length === 0) {
            results[tableName] = { sourceCount, inserted: 0, skipped: 'sem colunas em comum' }
            pending.delete(tableName)
            continue
          }

          const { rows: pkRows } = await targetPool.query(
            `select a.attname from pg_index i
             join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
             where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisprimary`,
            [tableName]
          )
          const pk = pkRows.map((r) => r.attname).filter((c) => cols.includes(c))

          const colList = cols.map(quoteIdent).join(', ')
          const { rows: srcRows } = await sourcePool.query(`select ${colList} from public.${quoteIdent(tableName)}`)

          let inserted = 0
          for (const row of srcRows) {
            const values = cols.map((c) => row[c])
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
            const conflictClause = pk.length > 0 ? `on conflict (${pk.map(quoteIdent).join(', ')}) do nothing` : ''
            const sql = `insert into public.${quoteIdent(tableName)} (${colList}) values (${placeholders}) ${conflictClause}`
            const r = await targetPool.query(sql, values)
            inserted += r.rowCount ?? 0
          }

          results[tableName] = { sourceCount, inserted }
          pending.delete(tableName)
        } catch (err: any) {
          // Provavelmente FK apontando pra tabela ainda não migrada — tenta de novo na próxima passada
          results[tableName] = { error: err.message, pass }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      mode,
      remainingAfterRetries: Array.from(pending),
      results,
    })
  } catch (err: any) {
    console.error('[migrate-old-db]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  } finally {
    await sourcePool.end()
  }
}

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"'
}

async function commonColumns(sourcePool: Pool, targetPool: Pool, tableName: string): Promise<string[]> {
  const q = `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`
  const [{ rows: srcCols }, { rows: tgtCols }] = await Promise.all([
    sourcePool.query(q, [tableName]),
    targetPool.query(q, [tableName]),
  ])
  const tgtSet = new Set(tgtCols.map((r) => r.column_name))
  return srcCols.map((r) => r.column_name).filter((c) => tgtSet.has(c))
}
