/**
 * Estado derivado de assinatura/trial — SOMENTE para exibição (admin, e no
 * futuro qualquer outra tela que precise mostrar "o que está acontecendo"
 * de forma legível para humanos).
 *
 * Não decide acesso. A regra de bloqueio real continua 100% em
 * lib/subscription/check.ts (checkPlan) e nas policies de RLS
 * (company_has_basic_access / company_has_pro_access / company_has_paid_plan)
 * — este arquivo não é chamado por nenhuma delas e não deve ser.
 *
 * Existe porque antes cada tela calculava "trial expirado?" e "status" a
 * partir dos mesmos campos crus (subscription_status, trial_end,
 * current_period_end) só que separadamente, e podiam divergir (ex.: painel
 * de assinantes mostrando "Trial expirado" + "Em trial" ao mesmo tempo,
 * porque a coluna Trial olhava a data e a coluna Status olhava o campo cru
 * do banco, sem se falarem). Centralizando aqui, os dois vêm da mesma
 * fonte e nunca mais podem contradizer um ao outro.
 */

const GRACE_DAYS = 5 // mesmo valor de lib/subscription/check.ts — mantém os dois em sincronia

export type DerivedSubscriptionState =
  | 'trial_ativo'
  | 'trial_expirado'
  | 'assinante_ativo'
  | 'cancelamento_agendado'
  | 'pagamento_pendente'
  | 'pagamento_falhou'
  | 'assinatura_cancelada'
  | 'sem_assinatura'

export interface DerivedSubscription {
  state: DerivedSubscriptionState
  statusLabel: string
  statusBadge: 'success' | 'info' | 'warning' | 'error' | 'neutral'
  trialLabel: string
  trialWarn: boolean
}

export interface CompanySubscriptionFields {
  subscription_status: string | null
  trial_end: string | null
  current_period_end: string | null
  grace_period_end: string | null
}

export function deriveSubscriptionState(company: CompanySubscriptionFields): DerivedSubscription {
  const status = company.subscription_status ?? 'none'
  const now = Date.now()

  const trialEnd   = company.trial_end          ? new Date(company.trial_end).getTime()          : null
  const periodEnd  = company.current_period_end ? new Date(company.current_period_end).getTime() : null
  const graceEnd   = company.grace_period_end
    ? new Date(company.grace_period_end).getTime()
    : (periodEnd ? periodEnd + GRACE_DAYS * 86400000 : null)

  // ── Trial (mesma regra de bloqueio de checkPlan: status==='trialing' e
  //    trial_end no passado ou ausente = expirado) ──
  const trial = (() => {
    if (status !== 'trialing') return { trialLabel: '—', trialWarn: false }
    if (!trialEnd) return { trialLabel: 'Expirado', trialWarn: true }
    const days = Math.ceil((trialEnd - now) / 86400000)
    if (days < 0)  return { trialLabel: 'Expirado', trialWarn: true }
    if (days === 0) return { trialLabel: 'Termina hoje', trialWarn: true }
    return { trialLabel: `${days} dia${days === 1 ? '' : 's'}`, trialWarn: days <= 2 }
  })()

  // ── Status (mesmos branches de checkPlan, traduzidos em estado legível) ──
  if (status === 'active') {
    return { state: 'assinante_ativo', statusLabel: 'Pagante', statusBadge: 'success', ...trial }
  }

  if (status === 'trialing') {
    const expired = !trialEnd || now > trialEnd
    return expired
      ? { state: 'trial_expirado', statusLabel: 'Trial expirado', statusBadge: 'error', ...trial }
      : { state: 'trial_ativo',    statusLabel: 'Em trial',       statusBadge: 'info',  ...trial }
  }

  if (status === 'past_due') {
    const withinGrace = !!(graceEnd && now <= graceEnd)
    return withinGrace
      ? { state: 'pagamento_pendente', statusLabel: 'Pagamento pendente', statusBadge: 'warning', ...trial }
      : { state: 'pagamento_falhou',   statusLabel: 'Pagamento falhou',   statusBadge: 'error',   ...trial }
  }

  if (status === 'canceled' || status === 'expired') {
    const stillInPaidPeriod = !!(periodEnd && now < periodEnd)
    return stillInPaidPeriod
      ? { state: 'cancelamento_agendado', statusLabel: 'Cancelamento agendado', statusBadge: 'warning', ...trial }
      : { state: 'assinatura_cancelada',  statusLabel: 'Cancelado',             statusBadge: 'error',   ...trial }
  }

  if (status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired') {
    return { state: 'pagamento_falhou', statusLabel: 'Pagamento falhou', statusBadge: 'error', ...trial }
  }

  // 'blocked', 'paused', 'none' ou qualquer status não reconhecido
  return { state: 'sem_assinatura', statusLabel: 'Sem assinatura', statusBadge: 'neutral', ...trial }
}
