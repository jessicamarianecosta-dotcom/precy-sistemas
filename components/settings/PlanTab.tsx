'use client'
import { useState } from 'react'
import { Crown, CheckCircle, Loader2, ExternalLink, AlertTriangle, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import { useSubscription } from '@/hooks/useSubscription'

const BASIC_FEATURES = [
  'Dashboard com visão geral', 'Cadastro de produtos (até 20)',
  'Controle de estoque', 'Precificação inteligente',
  'Gestão de pedidos Kanban (até 30)', 'Suporte por e-mail',
]
const PRO_FEATURES = [
  'Tudo do Basic + ilimitados', 'Cadastro completo de clientes',
  'Agenda integrada', 'Controle financeiro completo',
  'Orçamentos PDF', 'Relatórios avançados',
  'Biblioteca de conteúdos', 'Suporte WhatsApp',
]

export function PlanTab() {
  const { data: sub, isLoading } = useSubscription()
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [loadingPortal,   setLoadingPortal]   = useState(false)

  async function handleUpgrade(plan: string) {
    setLoadingCheckout(true)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { alert('Erro ao iniciar upgrade.') }
    finally { setLoadingCheckout(false) }
  }

  async function handlePortal() {
    setLoadingPortal(true)
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } catch { alert('Erro ao abrir portal.') }
    finally { setLoadingPortal(false) }
  }

  if (isLoading) return <div className="py-12 text-center text-sm text-text-muted">Carregando plano...</div>

  const plan   = sub?.plan ?? 'basic'
  const status = sub?.status ?? 'trialing'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-text-muted dark:text-stone-500 uppercase tracking-wider mb-1">Plano atual</p>
            <div className="flex items-center gap-2">
              {plan === 'pro' && <Crown size={16} style={{ color: '#C4A47B' }} />}
              <span className="text-xl font-bold text-text-primary dark:text-stone-100">
                Precy+ {plan === 'pro' ? 'Pro' : 'Basic'}
              </span>
            </div>
          </div>
          <span className={clsx('text-xs font-bold px-3 py-1.5 rounded-full',
            status === 'active'   && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            status === 'trialing' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            status === 'past_due' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            status === 'canceled' && 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
          )}>
            {status === 'active' && '✅ Ativo'}
            {status === 'trialing' && '🕐 Trial gratuito'}
            {status === 'past_due' && '⚠️ Pagamento pendente'}
            {status === 'canceled' && '❌ Cancelado'}
          </span>
        </div>
        {status === 'trialing' && sub?.trialEnd && (
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <Clock size={12} />
            Trial expira em {new Date(sub.trialEnd).toLocaleDateString('pt-BR')}
          </div>
        )}
        {sub?.periodEnd && status === 'active' && (
          <p className="mt-2 text-xs text-text-muted">Próxima cobrança: {new Date(sub.periodEnd).toLocaleDateString('pt-BR')}</p>
        )}
        {status === 'past_due' && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200/60">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-400">Pagamento falhou. Atualize o cartão para manter o acesso.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={clsx('card border-2', plan === 'basic' ? 'border-primary' : 'border-transparent')}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-text-primary dark:text-stone-100">Basic</p>
              <p className="text-xl font-bold text-primary mt-0.5">R$17<span className="text-xs font-normal text-text-muted">/mês</span></p>
            </div>
            {plan === 'basic' && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">Atual</span>}
          </div>
          <div className="space-y-1.5 mb-4">
            {BASIC_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-text-secondary dark:text-stone-400">
                <CheckCircle size={11} className="text-primary flex-shrink-0" />{f}
              </div>
            ))}
          </div>
          {plan === 'basic' && status === 'trialing' && (
            <button onClick={() => handleUpgrade('basic')} disabled={loadingCheckout}
              className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50">
              {loadingCheckout && <Loader2 size={12} className="animate-spin" />} Assinar Basic
            </button>
          )}
        </div>

        <div className={clsx('card border-2 relative overflow-hidden', plan === 'pro' ? 'border-primary' : 'border-primary/40')}>
          <div className="absolute top-0 right-0 bg-primary text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl">RECOMENDADO</div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-text-primary dark:text-stone-100 flex items-center gap-1.5">
                <Crown size={13} style={{ color: '#C4A47B' }} />Pro
              </p>
              <p className="text-xl font-bold text-primary mt-0.5">R$47<span className="text-xs font-normal text-text-muted">/mês</span></p>
            </div>
            {plan === 'pro' && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">Atual</span>}
          </div>
          <div className="space-y-1.5 mb-4">
            {PRO_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-text-secondary dark:text-stone-400">
                <CheckCircle size={11} className="text-primary flex-shrink-0" />{f}
              </div>
            ))}
          </div>
          {plan !== 'pro' ? (
            <button onClick={() => handleUpgrade('pro')} disabled={loadingCheckout}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}>
              {loadingCheckout ? <Loader2 size={12} className="animate-spin" /> : <Crown size={12} />}
              Assinar Pro
            </button>
          ) : (
            <button onClick={handlePortal} disabled={loadingPortal}
              className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50">
              {loadingPortal ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              Gerenciar assinatura
            </button>
          )}
        </div>
      </div>

      {sub?.stripeSubscriptionId && (
        <p className="text-xs text-center text-text-muted">
          Cancelar ou atualizar cartão:{' '}
          <button onClick={handlePortal} className="text-primary hover:underline">Portal do cliente</button>
        </p>
      )}
    </div>
  )
}
