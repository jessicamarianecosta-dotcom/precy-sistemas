'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { clsx } from 'clsx'
import { Users, Search, ShieldCheck, ArrowLeft, ChevronDown } from 'lucide-react'
import type { Assinante } from '@/lib/admin/getAssinantes'

const PLAN_LABEL: Record<string, string> = { basic: 'Basic', pro: 'Pro' }

const CHECKOUT_LABEL: Record<string, { label: string; badge: string }> = {
  started:   { label: 'Iniciado',  badge: 'badge-warning' },
  completed: { label: 'Concluído', badge: 'badge-success' },
  expired:   { label: 'Expirado',  badge: 'badge-neutral' },
  abandoned: { label: 'Abandonado', badge: 'badge-error' },
  failed:    { label: 'Falhou',    badge: 'badge-error' },
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('pt-BR') } catch { return '—' }
}

function checkoutInfo(status: string | null) {
  if (!status) return { label: '—', badge: 'badge-neutral' }
  return CHECKOUT_LABEL[status] ?? { label: status, badge: 'badge-neutral' }
}

export function AssinantesClient({ initialData }: { initialData: Assinante[] }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: assinantes = initialData } = useQuery<Assinante[]>({
    queryKey: ['admin-assinantes'],
    initialData,
    queryFn: async () => {
      const res = await fetch('/api/admin/assinantes')
      if (!res.ok) throw new Error('Falha ao carregar assinantes')
      const json = await res.json()
      return json.assinantes ?? []
    },
  })

  // Realtime: avisa na hora quando uma nova empresa se cadastra, sem
  // precisar recarregar a página. Requer a policy de SELECT para o admin em
  // companies (ver migration 071) — sem ela o Realtime nunca entrega o
  // evento de INSERT de empresas de outros usuários.
  useEffect(() => {
    const channel = supabase
      .channel('admin-assinantes-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'companies' },
        (payload) => {
          const nome = (payload.new as any)?.name ?? 'nova empresa'
          toast('info', `Novo cadastro: ${nome}`)
          qc.invalidateQueries({ queryKey: ['admin-assinantes'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = assinantes.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.name?.toLowerCase().includes(q) ||
      (a.owner_name ?? '').toLowerCase().includes(q) ||
      (a.email ?? '').toLowerCase().includes(q) ||
      (a.owner_email ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary dark:text-stone-400 hover:text-primary dark:hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Voltar ao painel
      </Link>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary dark:text-stone-100">Assinantes</h1>
          <p className="text-xs text-text-secondary dark:text-stone-400">
            {assinantes.length} empresa{assinantes.length === 1 ? '' : 's'} cadastrada{assinantes.length === 1 ? '' : 's'} — consulta somente leitura
          </p>
        </div>
      </div>

      <div className="relative mt-4 mb-3 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          className="input pl-8 w-full text-sm"
          placeholder="Buscar por empresa, dono ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:border-border-dark">
              {['Empresa', 'Dono', 'E-mail', 'Cadastro', 'Último acesso', 'Uso', 'Trial', 'Status', 'Plano', 'Checkout'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-3 whitespace-nowrap">{h}</th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-sm text-text-muted">
                  <Users size={22} className="mx-auto mb-2 opacity-50" />
                  Nenhum assinante encontrado.
                </td>
              </tr>
            ) : filtered.map(a => {
              const showPlan = a.state === 'assinante_ativo' || a.state === 'cancelamento_agendado'
              const chk = checkoutInfo(a.checkoutStatus)
              const isOpen = expanded === a.id
              return (
                <Fragment key={a.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                    className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/20 dark:hover:bg-white/[0.02] cursor-pointer"
                  >
                    <td className="p-3 text-sm font-semibold text-text-primary dark:text-stone-100 whitespace-nowrap">{a.name}</td>
                    <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">{a.owner_name || '—'}</td>
                    <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">{a.owner_email || a.email || '—'}</td>
                    <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">{fmtDate(a.created_at)}</td>
                    <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">{a.lastAccessLabel}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={clsx('badge text-[10px]', `badge-${a.usageBadge}`)}>{a.usageLabel}</span>
                    </td>
                    <td className={clsx('p-3 text-xs whitespace-nowrap', a.trialWarn ? 'text-error font-medium' : 'text-text-secondary dark:text-stone-400')}>
                      {a.trialLabel}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={clsx('badge text-[10px]', `badge-${a.statusBadge}`)}>{a.statusLabel}</span>
                    </td>
                    <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">
                      {showPlan ? (PLAN_LABEL[a.current_plan ?? ''] ?? a.current_plan ?? '—') : '—'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={clsx('badge text-[10px]', chk.badge)}>{chk.label}</span>
                    </td>
                    <td className="p-3">
                      <ChevronDown size={14} className={clsx('text-text-muted transition-transform', isOpen && 'rotate-180')} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border dark:border-border-dark bg-primary-50/10 dark:bg-white/[0.015]">
                      <td colSpan={11} className="px-4 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                          <Detail label="Produtos" value={a.usageCounts.products} />
                          <Detail label="Materiais" value={a.usageCounts.materials} />
                          <Detail label="Clientes" value={a.usageCounts.customers} />
                          <Detail label="Pedidos" value={a.usageCounts.orders} />
                          <Detail label="Orçamentos" value={a.usageCounts.budgets} />
                          <Detail label="Checkout em" value={fmtDate(a.checkoutAt)} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">{label}</div>
      <div className="font-semibold text-text-primary dark:text-stone-100">{value}</div>
    </div>
  )
}
