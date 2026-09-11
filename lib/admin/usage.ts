/**
 * Classificação de USO/ENGAJAMENTO para o painel /admin/assinantes.
 *
 * Regra objetiva baseada só em dados que já existem no banco (nenhum
 * evento novo, nenhum tracking de clique):
 *   - contagem de registros criados em products, customers, orders,
 *     budgets e product_materials (todas as tabelas operacionais do
 *     dia a dia do Precy+);
 *   - auth.users.last_sign_in_at (já mantido pelo próprio Supabase Auth
 *     a cada login).
 *
 * "products" também representa precificação: cada produto guarda seu
 * próprio cálculo de custo/markup/preço final (material_cost,
 * markup_percentage, final_price) — não existe uma tabela separada de
 * "precificações" no schema atual, então criar um produto JÁ é o ato de
 * precificar algo no Precy+.
 *
 * Faixas (ajustáveis conforme o comportamento real observado depois que
 * o painel estiver no ar, mas o corte inicial é):
 *
 *   NÃO USOU  — nunca fez login depois do cadastro, OU nenhuma ação
 *               relevante registrada em nenhuma tabela.
 *   BAIXO USO — total de 1 a 3 ações relevantes.
 *   USOU      — 4 ou mais ações relevantes, mas sem login nos últimos
 *               7 dias (chegou a usar, mas não voltou recentemente).
 *   ATIVO     — 4 ou mais ações relevantes E login nos últimos 7 dias
 *               (uso recorrente e recente).
 */

const ACTIVE_LOOKBACK_DAYS = 7
const LOW_USAGE_MAX = 3

export type UsageLevel = 'nao_usou' | 'baixo_uso' | 'usou' | 'ativo'

export interface UsageCounts {
  n_products: number
  n_customers: number
  n_orders: number
  n_budgets: number
  n_materials: number
}

export interface UsageClassification {
  level: UsageLevel
  label: string
  badge: 'neutral' | 'warning' | 'info' | 'success'
  totalActions: number
}

export function classifyUsage(counts: UsageCounts, lastSignInAt: string | null): UsageClassification {
  const totalActions =
    counts.n_products + counts.n_customers + counts.n_orders + counts.n_budgets + counts.n_materials

  if (!lastSignInAt || totalActions === 0) {
    return { level: 'nao_usou', label: 'Não usou', badge: 'neutral', totalActions }
  }

  if (totalActions <= LOW_USAGE_MAX) {
    return { level: 'baixo_uso', label: 'Baixo uso', badge: 'warning', totalActions }
  }

  const daysSinceLastAccess = (Date.now() - new Date(lastSignInAt).getTime()) / 86400000
  if (daysSinceLastAccess <= ACTIVE_LOOKBACK_DAYS) {
    return { level: 'ativo', label: 'Ativo', badge: 'success', totalActions }
  }

  return { level: 'usou', label: 'Usou', badge: 'info', totalActions }
}

/** "Hoje, 14:32" / "Ontem" / "Há 5 dias" / "Nunca acessou" — para a coluna Último acesso. */
export function formatLastAccess(lastSignInAt: string | null): string {
  if (!lastSignInAt) return 'Nunca acessou'

  const date = new Date(lastSignInAt)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

  if (diffDays === 0 && date.toDateString() === now.toDateString()) {
    return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  if (diffDays < 0) return 'Hoje' // relógio do servidor levemente adiantado — evita "há -1 dias"
  return `Há ${diffDays} dia${diffDays === 1 ? '' : 's'}`
}
