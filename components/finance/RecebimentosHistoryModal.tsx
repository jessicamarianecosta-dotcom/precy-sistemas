'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import type { OrderReceivable } from '@/lib/orders/receivables'

type SupabaseClient = any

const METHOD_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
  boleto: 'Boleto', transferencia: 'Transferência', crediario: 'Crediário', outro: 'Outro',
}

export function RecebimentosHistoryModal({
  receivable,
  companyId,
  supabase,
  onClose,
}: {
  receivable: OrderReceivable
  companyId: string
  supabase: SupabaseClient
  onClose: () => void
}) {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['payment_history', receivable.orderId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from('payment_history')
        .select('id, amount, payment_date, payment_method, observation')
        .eq('order_id', receivable.orderId)
        .eq('company_id', companyId)
        .order('payment_date', { ascending: true })
      return (data ?? []) as Array<{
        id: string; amount: number; payment_date: string; payment_method: string | null; observation: string | null
      }>
    },
  })

  const totalReceived = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-modal max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
          <div>
            <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Histórico de recebimentos</h3>
            <p className="text-xs text-text-muted">
              {receivable.orderNumber || '—'} · {receivable.customerName || 'Sem cliente'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:bg-stone-100 dark:hover:bg-stone-800">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {isLoading ? (
            <p className="py-6 text-center text-xs text-text-muted">Carregando…</p>
          ) : (rows ?? []).length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">Nenhum recebimento registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {(rows ?? []).map(r => (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-border dark:border-border-dark p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{formatCurrency(r.amount)}</p>
                    <p className="text-[11px] text-text-muted">
                      {format(new Date(r.payment_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      {r.payment_method ? ` · ${METHOD_LABELS[r.payment_method] ?? r.payment_method}` : ''}
                    </p>
                    {r.observation && <p className="text-[11px] text-text-muted/80 mt-0.5 truncate">{r.observation}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-stone-50 dark:bg-stone-800/50 p-3 text-xs">
            <span className="text-text-muted">Total recebido</span>
            <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(totalReceived)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-stone-50 dark:bg-stone-800/50 p-3 text-xs">
            <span className="text-text-muted">Saldo</span>
            <span className="font-bold text-text-primary dark:text-stone-100">{formatCurrency(receivable.balance)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
