'use client'

import { useState, useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import { ORDER_PAYMENT_METHODS } from '@/lib/orders/paymentSchedule'
import { recalcOrderPaymentStatus, recalcCustomerTotalPurchases } from '@/lib/orders/recalc'
import type { OrderReceivable, ReceivableInstallment, ReceivableStatus } from '@/lib/orders/receivables'

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
  initialInstallmentId,
  companyId,
  supabase,
  onClose,
}: {
  receivable: OrderReceivable
  /** Parcela pré-selecionada (ex.: clique em "Receber" numa parcela específica). */
  initialInstallmentId?: string | null
  companyId: string
  supabase: SupabaseClient
  onClose: () => void
}) {
  const { toast } = useToast()
  const qc = useQueryClient()

  const balance = round2(receivable.balance)
  const fmtInput = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /* Parcelas ainda com saldo — as mesmas linhas de payment_schedule exibidas na edição do pedido. */
  const openInstallments = useMemo(
    () => receivable.installments.filter(i => i.status !== 'recebido' && i.status !== 'cancelado'),
    [receivable.installments],
  )
  const hasInstallments = openInstallments.length > 0
  const defaultInstallment = openInstallments.find(i => i.id === (initialInstallmentId ?? receivable.nextScheduleId)) ?? openInstallments[0] ?? null

  const [mode, setMode] = useState<'parcela' | 'total'>('parcela')
  const [selectedId, setSelectedId] = useState<string | null>(defaultInstallment?.id ?? null)
  const selected: ReceivableInstallment | null = openInstallments.find(i => i.id === selectedId) ?? null

  /* Teto do valor: saldo da parcela escolhida, ou saldo do pedido (parcela única/legado/quitação total). */
  const useParcela = hasInstallments && mode === 'parcela' && !!selected
  const cap = useParcela ? selected!.balance : balance

  const [amountText, setAmountText] = useState(fmtInput(defaultInstallment ? defaultInstallment.balance : balance))
  const [method, setMethod] = useState<string>(defaultInstallment?.paymentMethod ?? receivable.paymentMethod ?? 'pix')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const submitting = useRef(false)

  const amount = useMemo(() => parseBRL(amountText), [amountText])

  function pickInstallment(i: ReceivableInstallment) {
    setMode('parcela')
    setSelectedId(i.id)
    setAmountText(fmtInput(i.balance))
    setMethod(i.paymentMethod)
  }

  function pickTotal() {
    setMode('total')
    setAmountText(fmtInput(balance))
  }

  const validationError = useMemo(() => {
    if (!amountText.trim() || Number.isNaN(amount) || amount <= 0) {
      return 'Informe um valor válido para o recebimento.'
    }
    if (hasInstallments && mode === 'parcela' && !selected) return 'Selecione a parcela que está sendo recebida.'
    if (round2(amount) > cap) {
      return useParcela
        ? 'Valor recebido não pode ser maior que o saldo da parcela.'
        : 'Valor recebido não pode ser maior que o saldo pendente.'
    }
    return null
  }, [amountText, amount, cap, useParcela, hasInstallments, mode, selected])

  const isFull = !validationError && round2(amount) === cap

  const mutation = useMutation({
    mutationFn: async () => {
      if (submitting.current) return
      if (validationError) throw new Error(validationError)
      if (!companyId) throw new Error('Empresa não encontrada.')
      submitting.current = true

      try {
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

        /* Rateio do valor entre parcelas: parcela escolhida → só nela;
           quitação do saldo → parcelas em aberto na ordem (FIFO); o que
           sobrar (pedido legado sem parcela) vai sem vínculo de parcela. */
        let allocations: Array<{ scheduleId: string | null; amount: number; label: string | null }>
        if (useParcela) {
          const { data: fresh } = await supabase.from('payment_schedule')
            .select('amount, received_amount, status')
            .eq('id', selected!.id)
            .single()
          const freshBalance = fresh ? round2(Number(fresh.amount) - Number(fresh.received_amount)) : selected!.balance
          if (value > freshBalance) {
            throw new Error(`O saldo da parcela mudou. Máximo permitido agora: ${formatCurrency(freshBalance)}.`)
          }
          allocations = [{ scheduleId: selected!.id, amount: value, label: `Parcela ${selected!.number}/${selected!.count}` }]
        } else {
          const { data: open } = await supabase.from('payment_schedule')
            .select('id, installment_number, installment_count, amount, received_amount, status')
            .eq('order_id', receivable.orderId)
            .eq('company_id', companyId)
            .order('installment_number', { ascending: true })
          allocations = []
          let remaining = value
          for (const r of open ?? []) {
            if (remaining <= 0) break
            if (r.status === 'cancelado' || r.status === 'recebido') continue
            const free = round2(Number(r.amount) - Number(r.received_amount))
            if (free <= 0) continue
            const part = Math.min(free, remaining)
            allocations.push({ scheduleId: r.id, amount: round2(part), label: `Parcela ${r.installment_number}/${r.installment_count}` })
            remaining = round2(remaining - part)
          }
          if (remaining > 0) allocations.push({ scheduleId: null, amount: remaining, label: null })
        }

        const userId = (await supabase.auth.getUser()).data.user?.id ?? null

        /* Mesma RPC transacional usada pelo módulo Pedidos: grava
           payment_history + financial_transactions + payment_schedule num
           único INSERT. Se um falha, o Postgres desfaz todos. */
        for (const part of allocations) {
          const percentage = receivable.total > 0 ? (part.amount / receivable.total) * 100 : 0
          const { error: rpcError } = await supabase.rpc('register_order_payment', {
            p_order_id: receivable.orderId,
            p_company_id: companyId,
            p_customer_id: receivable.customerId,
            p_amount: part.amount,
            p_payment_date: date,
            p_payment_method: method || null,
            p_observation: part.label
              ? `${part.label} — recebido pelo Financeiro`
              : 'Recebido pelo Financeiro (Contas a Receber)',
            p_percentage: percentage,
            p_order_number: receivable.orderNumber || '',
            p_service_name: receivable.serviceName || 'Serviço',
            p_client_name: receivable.customerName || null,
            p_created_by: userId,
            p_schedule_id: part.scheduleId,
          })
          if (rpcError) throw new Error(`Erro ao registrar recebimento: ${rpcError.message}`)
        }

        await recalcOrderPaymentStatus(
          supabase, receivable.orderId, companyId, receivable.total, receivable.paidAt,
        )
        if (receivable.customerId) {
          await recalcCustomerTotalPurchases(supabase, receivable.customerId, companyId)
        }
      } finally {
        submitting.current = false
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

          {hasInstallments && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-secondary dark:text-stone-400">
                Qual parcela está sendo recebida?
                <span className="text-text-muted font-normal"> · {receivable.installmentsPaid} de {receivable.installments.length} quitada(s)</span>
              </p>
              <div className="space-y-1.5">
                {receivable.installments.map(i => {
                  const done = i.status === 'recebido' || i.status === 'cancelado'
                  const active = mode === 'parcela' && selectedId === i.id
                  return (
                    <button
                      key={i.id}
                      type="button"
                      disabled={done || mutation.isPending}
                      onClick={() => pickInstallment(i)}
                      className={[
                        'w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors',
                        active ? 'border-primary bg-primary-50 dark:bg-primary/10' : 'border-border dark:border-border-dark',
                        done ? 'opacity-60 cursor-default' : 'hover:border-primary/60',
                      ].join(' ')}
                    >
                      <span className="min-w-0">
                        <span className="font-semibold text-text-primary dark:text-stone-100">{i.number}/{i.count}</span>
                        <span className="text-text-muted"> · {format(new Date(i.dueDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-bold text-text-primary dark:text-stone-100">
                          {formatCurrency(done ? i.amount : i.balance)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${INSTALLMENT_BADGE[i.status]}`}>
                          {INSTALLMENT_LABEL[i.status]}
                        </span>
                      </span>
                    </button>
                  )
                })}
                {openInstallments.length > 1 && (
                  <button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={pickTotal}
                    className={[
                      'w-full rounded-xl border px-3 py-2 text-left text-xs',
                      mode === 'total' ? 'border-primary bg-primary-50 dark:bg-primary/10' : 'border-dashed border-border dark:border-border-dark hover:border-primary/60',
                    ].join(' ')}
                  >
                    <span className="font-semibold text-text-primary dark:text-stone-100">Quitar saldo total do pedido</span>
                    <span className="text-text-muted"> · {formatCurrency(balance)} (parcelas em aberto, em ordem)</span>
                  </button>
                )}
              </div>
            </div>
          )}

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
              onClick={() => setAmountText(fmtInput(cap))}
              className="mt-1 text-[11px] text-primary hover:underline"
            >
              {useParcela ? `Valor da parcela (${formatCurrency(cap)})` : `Preencher com o saldo total (${formatCurrency(cap)})`}
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
              {useParcela
                ? `Valor menor que a parcela — ela fica “Parcial” com saldo de ${formatCurrency(round2(cap - amount))}.`
                : `Recebimento parcial — saldo restante ${formatCurrency(round2(cap - amount))}. O pedido continua como “Parcial”.`}
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

const INSTALLMENT_LABEL: Record<ReceivableStatus, string> = {
  a_receber: 'A receber', parcial: 'Parcial', vencido: 'Vencida', recebido: 'Recebida', cancelado: 'Cancelada',
}
const INSTALLMENT_BADGE: Record<ReceivableStatus, string> = {
  a_receber: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  parcial:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  vencido:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  recebido:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelado: 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500',
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
