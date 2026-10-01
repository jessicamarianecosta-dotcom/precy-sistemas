import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Pool, PoolClient } from 'pg'

const ADMIN_EMAIL = 'jessicamarianecosta@gmail.com'
const OLD_REF = 'ekynvecruqpuwwrcwtnp'
const NEW_REF = 'xtisgwnxvyygtswlldvi'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/admin/migrate-old-db?mode=inspect|migrate&confirm=sim&tables=a,b
 *
 * Ferramenta temporária, admin-only, para copiar TUDO do projeto Supabase
 * antigo (ekynvecruqpuwwrcwtnp, via OLD_DATABASE_URL) para o novo
 * (xtisgwnxvyygtswlldvi, via a conexão direta da integração Supabase↔Vercel).
 *
 * Travas de segurança:
 *  - a origem TEM que ser o projeto antigo e o destino TEM que ser o novo;
 *    se as strings de conexão não baterem com os refs, a rota recusa.
 *  - nunca escreve no banco antigo e nunca apaga nada no novo.
 *
 * mode=inspect (padrão): só lê. Compara contagem e a data mais recente de
 * cada tabela nos dois bancos.
 *
 * mode=migrate (exige confirm=sim): para cada tabela, insere as linhas que
 * faltam no novo (pelo PK) e atualiza as que existem nos dois só quando a
 * versão do antigo é mais nova (updated_at maior) — o que já foi gravado no
 * novo depois do corte não é sobrescrito. Copia também auth.users e
 * auth.identities (logins criados depois do snapshot). É idempotente: pode
 * rodar de novo se estourar o tempo (use tables=... para um subconjunto).
 * Os gatilhos ficam desligados durante a cópia (session_replication_role =
 * replica) para que números de pedido/orçamento e updated_at venham
 * exatamente como estão no banco antigo.
 *
 * Não copia arquivos do Storage (só as linhas do banco).
 * Remover esta rota depois que a migração for confirmada.
 */
export async function GET(request: Request) {
  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') === 'migrate' ? 'migrate' : 'inspect'
  const only = (url.searchParams.get('tables') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)

  if (mode === 'migrate' && url.searchParams.get('confirm') !== 'sim') {
    return NextResponse.json(
      { error: 'Para copiar de verdade, adicione &confirm=sim. Rode antes mode=inspect.' },
      { status: 400 }
    )
  }

  const oldUrl = process.env.OLD_DATABASE_URL
  if (!oldUrl) return NextResponse.json({ error: 'Missing OLD_DATABASE_URL' }, { status: 500 })
  if (!oldUrl.includes(OLD_REF)) {
    return NextResponse.json({ error: `OLD_DATABASE_URL não aponta para o projeto antigo (${OLD_REF}).` }, { status: 500 })
  }

  const newUrl = resolveNewDbUrl()
  if (!newUrl) {
    return NextResponse.json({ error: `Não achei a conexão direta do projeto novo (${NEW_REF}_POSTGRES_URL_NON_POOLING).` }, { status: 500 })
  }
  if (!newUrl.includes(NEW_REF) || newUrl.includes(OLD_REF)) {
    return NextResponse.json({ error: `A conexão de destino não é do projeto novo (${NEW_REF}). Abortado.` }, { status: 500 })
  }

  const sourcePool = makePool(oldUrl)
  const targetPool = makePool(newUrl)
  let target: PoolClient | null = null

  try {
    target = await targetPool.connect()

    if (mode === 'migrate') {
      try {
        await target.query(`set session_replication_role = replica`)
      } catch (e: any) {
        return NextResponse.json(
          { error: `Sem permissão para desligar gatilhos no destino (${e.message}). Abortado para não renumerar pedidos.` },
          { status: 500 }
        )
      }
    }

    const tables = await listTables(sourcePool)
    const selected = tables.filter((t) => only.length === 0 || only.includes(t.name) || only.includes(`${t.schema}.${t.name}`))

    const results: Record<string, any> = {}
    for (const t of selected) {
      const key = `${t.schema}.${t.name}`
      try {
        results[key] = mode === 'inspect'
          ? await inspectTable(sourcePool, target, t.schema, t.name)
          : await migrateTable(sourcePool, target, t.schema, t.name)
      } catch (err: any) {
        results[key] = { error: err.message }
      }
    }

    return NextResponse.json({ ok: true, mode, tables: selected.length, results })
  } catch (err: any) {
    console.error('[migrate-old-db]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  } finally {
    target?.release()
    await Promise.allSettled([sourcePool.end(), targetPool.end()])
  }
}

/** Conexão direta (sem pooler de transação) do projeto novo, da integração Supabase↔Vercel. */
function resolveNewDbUrl(): string | undefined {
  const env = process.env
  const key =
    Object.keys(env).find((k) => k.startsWith(`${NEW_REF}_`) && k.endsWith('_POSTGRES_URL_NON_POOLING')) ??
    Object.keys(env).find((k) => k.startsWith(`${NEW_REF}_`) && k.endsWith('_POSTGRES_URL'))
  return key ? env[key] : undefined
}

function makePool(raw: string): Pool {
  const u = new URL(raw)
  u.searchParams.delete('sslmode')
  return new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false }, max: 1 })
}

function q(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"'
}

/** Tabelas do app (public) + logins (auth.users e auth.identities), auth primeiro. */
async function listTables(source: Pool): Promise<{ schema: string; name: string }[]> {
  const { rows } = await source.query<{ table_name: string }>(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' and table_name not like '\\_mig\\_%'
    order by table_name
  `)
  return [
    { schema: 'auth', name: 'users' },
    { schema: 'auth', name: 'identities' },
    ...rows.map((r) => ({ schema: 'public', name: r.table_name })),
  ]
}

/** Colunas graváveis (não geradas) presentes nos dois bancos. */
async function commonColumns(source: Pool, target: PoolClient, schema: string, table: string): Promise<string[]> {
  const sql = `select column_name from information_schema.columns
               where table_schema = $1 and table_name = $2 and is_generated = 'NEVER'`
  const [s, t] = await Promise.all([source.query(sql, [schema, table]), target.query(sql, [schema, table])])
  const tgt = new Set(t.rows.map((r) => r.column_name))
  return s.rows.map((r) => r.column_name).filter((c) => tgt.has(c))
}

async function primaryKey(target: PoolClient, schema: string, table: string): Promise<string[]> {
  const { rows } = await target.query(
    `select a.attname from pg_index i
     join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
     where i.indrelid = ($1 || '.' || quote_ident($2))::regclass and i.indisprimary`,
    [q(schema), table]
  )
  return rows.map((r) => r.attname)
}

async function tableStats(db: { query: Pool['query'] }, schema: string, table: string, cols: Set<string>) {
  const tsCol = cols.has('updated_at') ? 'updated_at' : cols.has('created_at') ? 'created_at' : null
  const { rows } = await db.query(
    `select count(*)::int as c${tsCol ? `, max(${q(tsCol)}) as latest` : ''} from ${q(schema)}.${q(table)}`
  )
  return { count: rows[0].c as number, latest: tsCol ? (rows[0].latest as Date | null) : null }
}

async function inspectTable(source: Pool, target: PoolClient, schema: string, table: string) {
  const colsQ = `select column_name from information_schema.columns where table_schema = $1 and table_name = $2`
  const [sc, tc] = await Promise.all([source.query(colsQ, [schema, table]), target.query(colsQ, [schema, table])])
  if (tc.rows.length === 0) return { error: 'tabela não existe no projeto novo' }

  const s = await tableStats(source, schema, table, new Set(sc.rows.map((r) => r.column_name)))
  const t = await tableStats(target, schema, table, new Set(tc.rows.map((r) => r.column_name)))
  return {
    antigo: s.count,
    novo: t.count,
    antigoMaisRecente: s.latest,
    novoMaisRecente: t.latest,
    faltando: s.count > t.count ? s.count - t.count : 0,
  }
}

async function migrateTable(source: Pool, target: PoolClient, schema: string, table: string) {
  const cols = await commonColumns(source, target, schema, table)
  if (cols.length === 0) return { skipped: 'sem colunas em comum (tabela ausente no novo?)' }

  const pk = (await primaryKey(target, schema, table)).filter((c) => cols.includes(c))
  const qt = `${q(schema)}.${q(table)}`
  const colList = cols.map(q).join(', ')

  const { rows } = await source.query(`select ${colList} from ${qt}`)
  if (rows.length === 0) return { antigo: 0, inseridas: 0, atualizadas: 0 }

  if (pk.length === 0) {
    const { rows: c } = await target.query(`select count(*)::int as c from ${qt}`)
    if (c[0].c > 0) return { antigo: rows.length, skipped: 'tabela sem PK e já tem dados no novo' }
  }

  const nonPk = cols.filter((c) => !pk.includes(c))
  let conflict = ''
  if (pk.length > 0) {
    conflict =
      cols.includes('updated_at') && nonPk.length > 0
        ? `on conflict (${pk.map(q).join(', ')}) do update set ${nonPk.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')}
           where ${q(table)}.${q('updated_at')} < excluded.${q('updated_at')}`
        : `on conflict (${pk.map(q).join(', ')}) do nothing`
  }

  let inseridas = 0
  let atualizadas = 0
  const CHUNK = 300
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const r = await target.query(
      `insert into ${qt} (${colList})
       select ${colList} from json_populate_recordset(null::${qt}, $1::json)
       ${conflict}
       returning (xmax = 0) as ins`,
      [JSON.stringify(chunk)]
    )
    for (const row of r.rows) row.ins ? inseridas++ : atualizadas++
  }

  return { antigo: rows.length, inseridas, atualizadas }
}
