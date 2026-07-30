'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { clsx } from 'clsx'
import { Users, Search, ShieldCheck } from 'lucide-react'
import type { Assinante } from '@/lib/admin/getAssinantes'

const PLAN_LABEL: Record<string, string> = { basic: 'Basic', pro: 'Pro' }

const STATUS_LABEL: Record<string, { label: string; badge: string }> = {
  trialing:  { label: 'Em trial',    badge: 'badge-info' },
  active:    { label: 'Pagante',     badge: 'badge-success' },
  canceled:  { label: 'Cancelado',   badge: 'badge-error' },
  expired:   { label: 'Cancelado',   badge: 'badge-error' },
  past_due:  { label: 'Inadimplente', badge: 'badge-warning' },
  none:      { label: 'Sem assinatura', badge: 'badge-error' },
}

function statusInfo(status: string | null) {
  return STATUS_LABEL[status ?? 'none'] ?? { label: status ?? '—', badge: 'badge-error' }
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('pt-BR') } catch { return '—' }
}

function trialLabel(trialEnd: string | null): { text: string; warn: boolean } {
  if (!trialEnd) return { text: '—', warn: false }
  const diffMs = new Date(trialEnd).getTime() - Date.now()
  const days = Math.ceil(diffMs / 86400000)
  if (days < 0) return { text: 'Trial expirado', warn: true }
  if (days === 0) return { text: 'Termina hoje', warn: true }
  return { text: `${days} dia${days === 1 ? '' : 's'}`, warn: days <= 2 }
}

export function AssinantesClient({ initialData }: { initialData: Assinante[] }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')

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
              {['Empresa', 'Dono', 'E-mail', 'Cadastro', 'Trial', 'Status', 'Plano'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-text-muted">
                  <Users size={22} className="mx-auto mb-2 opacity-50" />
                  Nenhum assinante encontrado.
                </td>
              </tr>
            ) : filtered.map(a => {
              const st = statusInfo(a.subscription_status)
              const trial = trialLabel(a.trial_end)
              const showPlan = a.subscription_status === 'active'
              return (
                <tr key={a.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/20 dark:hover:bg-white/[0.02]">
                  <td className="p-3 text-sm font-semibold text-text-primary dark:text-stone-100 whitespace-nowrap">{a.name}</td>
                  <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">{a.owner_name || '—'}</td>
                  <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">{a.owner_email || a.email || '—'}</td>
                  <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">{fmtDate(a.created_at)}</td>
                  <td className={clsx('p-3 text-xs whitespace-nowrap', trial.warn ? 'text-error font-medium' : 'text-text-secondary dark:text-stone-400')}>
                    {trial.text}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={clsx('badge text-[10px]', st.badge)}>{st.label}</span>
                  </td>
                  <td className="p-3 text-xs text-text-secondary dark:text-stone-400 whitespace-nowrap">
                    {showPlan ? (PLAN_LABEL[a.current_plan ?? ''] ?? a.current_plan ?? '—') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
