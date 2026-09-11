import { supabaseAdmin } from '@/lib/supabase/admin'
import { deriveSubscriptionState, type DerivedSubscriptionState } from '@/lib/subscription/status'
import { classifyUsage, formatLastAccess, type UsageLevel } from '@/lib/admin/usage'

export interface Assinante {
  id: string
  name: string
  email: string | null
  created_at: string
  trial_end: string | null
  subscription_status: string | null
  current_plan: string | null
  owner_name: string | null
  owner_email: string | null

  // ── Derivados no servidor (única fonte de verdade — o client só exibe) ──
  state: DerivedSubscriptionState
  statusLabel: string
  statusBadge: 'success' | 'info' | 'warning' | 'error' | 'neutral'
  trialLabel: string
  trialWarn: boolean

  lastSignInAt: string | null
  lastAccessLabel: string

  usage: UsageLevel
  usageLabel: string
  usageBadge: 'neutral' | 'warning' | 'info' | 'success'
  usageCounts: {
    products: number
    customers: number
    orders: number
    budgets: number
    materials: number
  }

  checkoutStatus: string | null
  checkoutAt: string | null
}

interface UsageStatsRow {
  company_id: string
  last_sign_in_at: string | null
  n_products: number
  n_customers: number
  n_orders: number
  n_budgets: number
  n_materials: number
  checkout_status: string | null
  checkout_at: string | null
}

export async function getAssinantes(): Promise<Assinante[]> {
  const [{ data, error }, statsResult] = await Promise.all([
    (supabaseAdmin.from('companies') as any)
      .select('id, name, email, created_at, trial_end, subscription_status, current_plan, current_period_end, grace_period_end, profiles:user_id(name, email)')
      .order('created_at', { ascending: false }),
    // Uma única consulta agregada pra todas as empresas — ver migration 082.
    // Nunca falha o carregamento do painel: se a função ainda não existir
    // (migration não aplicada) ou der erro, cai para "sem dados de uso"
    // em vez de quebrar a tela inteira.
    (supabaseAdmin.rpc('admin_get_company_usage_stats') as any),
  ])

  if (error) throw error

  const statsByCompany = new Map<string, UsageStatsRow>()
  if (!statsResult.error && Array.isArray(statsResult.data)) {
    for (const row of statsResult.data as UsageStatsRow[]) {
      statsByCompany.set(row.company_id, row)
    }
  } else if (statsResult.error) {
    console.error('[admin/getAssinantes] admin_get_company_usage_stats indisponível:', statsResult.error.message)
  }

  return (data ?? []).map((row: any) => {
    const derived = deriveSubscriptionState({
      subscription_status: row.subscription_status,
      trial_end:           row.trial_end,
      current_period_end:  row.current_period_end,
      grace_period_end:    row.grace_period_end,
    })

    const stats = statsByCompany.get(row.id)
    const counts = {
      products:  stats?.n_products  ?? 0,
      customers: stats?.n_customers ?? 0,
      orders:    stats?.n_orders    ?? 0,
      budgets:   stats?.n_budgets   ?? 0,
      materials: stats?.n_materials ?? 0,
    }
    const usage = classifyUsage(
      { n_products: counts.products, n_customers: counts.customers, n_orders: counts.orders, n_budgets: counts.budgets, n_materials: counts.materials },
      stats?.last_sign_in_at ?? null
    )

    return {
      id:                   row.id,
      name:                 row.name,
      email:                row.email,
      created_at:           row.created_at,
      trial_end:            row.trial_end,
      subscription_status:  row.subscription_status,
      current_plan:         row.current_plan,
      owner_name:           row.profiles?.name ?? null,
      owner_email:          row.profiles?.email ?? null,

      state:        derived.state,
      statusLabel:  derived.statusLabel,
      statusBadge:  derived.statusBadge,
      trialLabel:   derived.trialLabel,
      trialWarn:    derived.trialWarn,

      lastSignInAt:     stats?.last_sign_in_at ?? null,
      lastAccessLabel:  formatLastAccess(stats?.last_sign_in_at ?? null),

      usage:        usage.level,
      usageLabel:   usage.label,
      usageBadge:   usage.badge,
      usageCounts:  counts,

      checkoutStatus: stats?.checkout_status ?? null,
      checkoutAt:     stats?.checkout_at ?? null,
    }
  })
}
