'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import {
  daysUntil, effectiveScheduleStatus, SCHEDULE_STATUS_LABELS, type ScheduleDisplayStatus,
} from '@/lib/orders/paymentSchedule'

type SupabaseClient = any

interface ScheduleRow {
  id: string
  order_id: string
  due_date: string
  amount: number
  received_amount: number
  payment_method: string
  status: string
  orders: { order_number: string | null; customers: { name: string } | null } | null
}

const STATUS_FILTERS: { value: ScheduleDisplayStatus | 'todos'; label: string }[] = [
  { value: 'todos',     label: 'Todos' },
  { value: 'a_receber', label: 'A Receber' },
  { value: 'parcial',   label: 'Parcial' },
  { value: 'vencido',   label: 'Vencido' },
  { value: 'recebido',  label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const BADGE_CLASS: Record<ScheduleDisplayStatus, string> = {
  a_receber: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  parcial:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  vencido:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  recebido:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelado: 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500',
}

const METHOD_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
  boleto: 'Boleto', transferencia: 'Transferência', crediario: 'Crediário', outro: 'Outro',
}

export function ContasAReceberPanel({ companyId, supabase }: { companyId: string | null; supabase: SupabaseClient }) {
  const [expanded, setExpanded] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ScheduleDisplayStatus | 'todos'>('todos')

  const { data: rows, isLoading } = useQuery<ScheduleRow[]>({
    queryKey: ['contas-a-receber', companyId],
    enabled:  !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('payment_schedule') as any)
        .select('id, order_id, due_date, amount, received_amount, payment_method, status, orders(order_number, customers(name))')
        .eq('company_id', companyId!)
        .neq('status', 'recebido')
        .order('due_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as ScheduleRow[]
    },
  })

  const visibleRows = (rows ?? []).filter(r => {
    const st = effectiveScheduleStatus(r)
    return statusFilter === 'todos' || st === statusFilter
  })

  const totalPendente = (rows ?? [])
    .filter(r => r.status !== 'cancelado')
    .reduce((s, r) => s + (Number(r.amount) - Number(r.received_amount)), 0)

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
            <Wallet size={16} className="text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Contas a Receber</p>
            <p className="text-xs text-text-muted dark:text-stone-400">
              {(rows ?? []).filter(r => r.status !== 'cancelado').length} pedido(s) · {formatCurrency(totalPendente)} pendente
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                  statusFilter === f.value
                    ? 'bg-primary text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-text-secondary dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-6 text-center text-xs text-text-muted">Carregando…</div>
          ) : visibleRows.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-muted">Nenhuma conta a receber neste filtro.</div>
          ) : (
            <div className="rounded-xl border border-border dark:border-border-dark overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/50 text-[10px] uppercase tracking-wide text-text-muted">
                    <th className="text-left font-semibold px-3 py-2">Cliente</th>
                    <th className="text-left font-semibold px-3 py-2">Pedido</th>
                    <th className="text-left font-semibold px-3 py-2">Forma</th>
                    <th className="text-left font-semibold px-3 py-2">Vencimento</th>
                    <th className="text-right font-semibold px-3 py-2">Valor</th>
                    <th className="text-right font-semibold px-3 py-2">Status</th>
                    <th className="text-right font-semibold px-3 py-2">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, idx) => {
                    const st = effectiveScheduleStatus(row)
                    const dias = daysUntil(row.due_date)
                    const saldo = Number(row.amount) - Number(row.received_amount)
                    return (
                      <tr key={row.id} className={clsx(idx !== 0 && 'border-t border-border dark:border-border-dark')}>
                        <td className="px-3 py-2.5 max-w-[160px] truncate font-medium text-text-primary dark:text-stone-100">
                          {row.orders?.customers?.name || 'Sem cliente'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-text-muted">
                          {row.orders?.order_number || '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                          {METHOD_LABELS[row.payment_method] ?? row.payment_method}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                          {format(new Date(row.due_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap font-bold text-text-primary dark:text-stone-100">
                          {formatCurrency(saldo)}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold', BADGE_CLASS[st])}>
                            {SCHEDULE_STATUS_LABELS[st]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-text-muted">
                          {st === 'recebido' || st === 'cancelado' ? '—' : dias === 0 ? 'Hoje' : dias > 0 ? `${dias}d` : `${Math.abs(dias)}d atrás`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
