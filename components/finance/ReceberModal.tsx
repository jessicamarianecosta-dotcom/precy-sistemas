'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import { ORDER_PAYMENT_METHODS } from '@/lib/orders/paymentSchedule'
import { recalcOrderPaymentStatus, recalcCustomerTotalPurchases } from '@/lib/orders/recalc'
import type { OrderReceivable } from '@/lib/orders/receivables'

type SupabaseClient = any

/** Converte "1.734,20" ou "1734.20" em número. */
function parseBRL(input: string): number {
  const cleaned = input.trim().replace(/\s/g, '').replace(/R\$/i, '')
  if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.'))
  return Number(cleaned)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function ReceberModal({
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
  const { toast } = useToast()
  const qc = useQueryClient()

  const balance = round2(receivable.balance)
  const [amountText, setAmountText] = useState(
    balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  )
  const [method, setMethod] = useState<string>(receivable.paymentMethod ?? 'pix')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const amount = useMemo(() => parseBRL(amountText), [amountText])

  const validationError = useMemo(() => {
    if (!amountText.trim() || Number.isNaN(amount) || amount <= 0) {
      return 'Informe um valor válido para o recebimento.'
    }
    if (round2(amount) > balance) {
      return 'Valor recebido não pode ser maior que o saldo pendente.'
    }
    return null
  }, [amountText, amount, balance])

  const isFull = !validationError && round2(amount) === balance

  const mutation = useMutation({
    mutationFn: async () => {
      if (validationError) throw new Error(validationError)
      if (!companyId) throw new Error('Empresa não encontrada.')

      const value = round2(amount)

      /* Revalida o saldo contra o banco — protege contra recebimento
         registrado em outra aba entre abrir o modal e confirmar. */
      const { data: history } = await supabase.from('payment_history')
        .select('amount')
        .eq('order_id', receivable.orderId)
        .eq('company_id', companyId)
      const alreadyReceived = (history ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)
      if (round2(alreadyReceived + value) > round2(receivable.total)) {
        throw new Error(
          `O saldo mudou. Máximo permitido agora: ${formatCurrency(round2(receivable.total - alreadyReceived))}.`,
        )
      }

      const percentage = receivable.total > 0 ? (value / receivable.total) * 100 : 0
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null

      /* Mesma RPC transacional usada pelo módulo Pedidos: grava
         payment_history + financial_transactions + payment_schedule num
         único INSERT. Se um falha, o Postgres desfaz todos. */
      const { error: rpcError } = await supabase.rpc('register_order_payment', {
        p_order_id: receivable.orderId,
        p_company_id: companyId,
        p_customer_id: receivable.customerId,
        p_amount: value,
        p_payment_date: date,
        p_payment_method: method || null,
        p_observation: 'Recebido pelo Financeiro (Contas a Receber)',
        p_percentage: percentage,
        p_order_number: receivable.orderNumber || '',
        p_service_name: receivable.serviceName || 'Serviço',
        p_client_name: receivable.customerName || null,
        p_created_by: userId,
        p_schedule_id: receivable.nextScheduleId ?? null,
      })
      if (rpcError) throw new Error(`Erro ao registrar recebimento: ${rpcError.message}`)

      await recalcOrderPaymentStatus(
        supabase, receivable.orderId, companyId, receivable.total, receivable.paidAt,
      )
      if (receivable.customerId) {
        await recalcCustomerTotalPurchases(supabase, receivable.customerId, companyId)
      }
    },
    onSuccess: () => {
      /* Mesmas chaves invalidadas pelo módulo Pedidos — Financeiro,
         Dashboard, Fluxo de Caixa, DRE, Projeção e a própria tabela. */
      ;[
        'contas-a-receber', 'financial-transactions', 'transactions', 'dashboard',
        'fluxo-caixa', 'dre-transactions', 'financial-goals', 'goals-realized',
        'projecao-receivables', 'projecao-payables', 'projecao-recurring',
        'projecao-saldo-atual', 'orders', 'payment_history', 'payment_schedule',
      ].forEach(key => qc.invalidateQueries({ queryKey: [key, companyId] }))
      qc.invalidateQueries({ queryKey: ['payment_history', receivable.orderId] })
      qc.invalidateQueries({ queryKey: ['payment_schedule', receivable.orderId] })
      toast('success', 'Recebimento registrado com sucesso.')
      onClose()
    },
    onError: (err: Error) => toast('error', err.message),
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={() => !mutation.isPending && onClose()}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-modal max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Registrar recebimento</h3>
          <button
            onClick={() => !mutation.isPending && onClose()}
            className="p-1 rounded-lg text-text-muted hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 p-3 space-y-1.5 text-xs">
            <Row label="Cliente" value={receivable.customerName || 'Sem cliente'} />
            <Row label="Pedido" value={receivable.orderNumber || '—'} mono />
            <Row label="Valor total" value={formatCurrency(receivable.total)} />
            <Row label="Já recebido" value={formatCurrency(receivable.received)} />
            <div className="pt-1.5 border-t border-border dark:border-border-dark">
              <Row label="Saldo pendente" value={formatCurrency(balance)} strong />
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Valor recebido agora</span>
            <div className="mt-1 flex items-center rounded-xl border border-border dark:border-border-dark focus-within:border-primary bg-surface dark:bg-white/5">
              <span className="pl-3 text-sm text-text-muted">R$</span>
              <input
                inputMode="decimal"
                value={amountText}
                onChange={e => setAmountText(e.target.value)}
                className="w-full bg-transparent px-2 py-2.5 text-sm outline-none text-text-primary dark:text-stone-100"
                autoFocus
              />
              {isFull && <CheckCircle2 size={16} className="mr-3 text-green-600 flex-shrink-0" />}
            </div>
            <button
              type="button"
              onClick={() => setAmountText(balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
              className="mt-1 text-[11px] text-primary hover:underline"
            >
              Preencher com o saldo total ({formatCurrency(balance)})
            </button>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Forma de pagamento</span>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-primary text-text-primary dark:text-stone-100"
            >
              {ORDER_PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Data do recebimento</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-primary text-text-primary dark:text-stone-100"
            />
          </label>

          {validationError && amountText.trim() !== '' && (
            <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
          )}
          {!validationError && !isFull && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Recebimento parcial — saldo restante {formatCurrency(round2(balance - amount))}. O pedido continua como “Parcial”.
            </p>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border dark:border-border-dark">
          <button
            onClick={() => !mutation.isPending && onClose()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border dark:border-border-dark text-text-secondary dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!!validationError || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {mutation.isPending
              ? <><Loader2 size={15} className="animate-spin" /> Salvando…</>
              : <><CheckCircle2 size={15} /> Confirmar recebimento</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className={[
        strong ? 'font-bold text-text-primary dark:text-stone-100 text-sm' : 'text-text-secondary dark:text-stone-300',
        mono ? 'font-mono' : '',
      ].join(' ')}>{value}</span>
    </div>
  )
}
