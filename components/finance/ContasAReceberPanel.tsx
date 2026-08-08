'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Wallet, AlertTriangle, Clock3 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { fetchOrderReceivables, type OrderReceivable, type ReceivableStatus } from '@/lib/orders/receivables'
import { daysUntil } from '@/lib/orders/paymentSchedule'

type SupabaseClient = any

const STATUS_FILTERS: { value: ReceivableStatus | 'todos'; label: string }[] = [
  { value: 'todos',     label: 'Todos' },
  { value: 'a_receber', label: 'A Receber' },
  { value: 'parcial',   label: 'Parcial' },
  { value: 'vencido',   label: 'Vencido' },
  { value: 'recebido',  label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const BADGE_CLASS: Record<ReceivableStatus, string> = {
  a_receber: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  parcial:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  vencido:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  recebido:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelado: 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500',
}

const STATUS_LABELS: Record<ReceivableStatus, string> = {
  a_receber: 'A Receber', parcial: 'Parcial', vencido: 'Vencido', recebido: 'Recebido', cancelado: 'Cancelado',
}

const METHOD_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
  boleto: 'Boleto', transferencia: 'Transferência', crediario: 'Crediário', outro: 'Outro',
}

export function ContasAReceberPanel({ companyId, supabase }: { companyId: string | null; supabase: SupabaseClient }) {
  const [expanded, setExpanded] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ReceivableStatus | 'todos'>('todos')

  const { data: receivables, isLoading } = useQuery<OrderReceivable[]>({
    queryKey: ['contas-a-receber', companyId],
    enabled:  !!companyId,
    queryFn:  () => fetchOrderReceivables(supabase, companyId!),
  })

  const open = (receivables ?? []).filter(r => r.status !== 'cancelado' && r.balance > 0)
  const totalAReceber = open.reduce((s, r) => s + r.balance, 0)
  const parciais       = open.filter(r => r.status === 'parcial')
  const totalParcial   = parciais.reduce((s, r) => s + r.balance, 0)
  const vencidos        = open.filter(r => r.status === 'vencido')
  const totalVencido    = vencidos.reduce((s, r) => s + r.balance, 0)

  const visibleRows = (receivables ?? []).filter(r => {
    if (statusFilter === 'todos') return r.status !== 'recebido' && r.status !== 'cancelado'
    return r.status === statusFilter
  })

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
              {open.length} pedido(s) em aberto · {formatCurrency(totalAReceber)}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wide mb-1">
                <Wallet size={11} /> Total a Receber
              </div>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalAReceber)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wide mb-1">
                <Clock3 size={11} /> Recebimento Parcial
              </div>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalParcial)}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{parciais.length} pedido(s)</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wide mb-1">
                <AlertTriangle size={11} /> Recebimentos Vencidos
              </div>
              <p className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(totalVencido)}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{vencidos.length} pedido(s)</p>
            </div>
          </div>

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
                    <th className="text-right font-semibold px-3 py-2">Valor Total</th>
                    <th className="text-right font-semibold px-3 py-2">Recebido</th>
                    <th className="text-right font-semibold px-3 py-2">Saldo</th>
                    <th className="text-left font-semibold px-3 py-2">Forma</th>
                    <th className="text-left font-semibold px-3 py-2">Vencimento</th>
                    <th className="text-right font-semibold px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, idx) => (
                    <tr key={row.orderId} className={clsx(idx !== 0 && 'border-t border-border dark:border-border-dark')}>
                      <td className="px-3 py-2.5 max-w-[160px] truncate font-medium text-text-primary dark:text-stone-100">
                        {row.customerName || 'Sem cliente'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-text-muted">
                        {row.orderNumber || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-text-muted">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-green-700 dark:text-green-400">
                        {formatCurrency(row.received)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap font-bold text-text-primary dark:text-stone-100">
                        {formatCurrency(row.balance)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                        {row.paymentMethod ? (METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod) : '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                        {row.dueDate ? format(new Date(row.dueDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                        {row.dueDate && row.status !== 'recebido' && row.status !== 'cancelado' && (
                          <span className="text-[10px] text-text-muted/70 ml-1">
                            ({(() => { const d = daysUntil(row.dueDate!); return d === 0 ? 'hoje' : d > 0 ? `${d}d` : `${Math.abs(d)}d atrás` })()})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold', BADGE_CLASS[row.status])}>
                          {STATUS_LABELS[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
