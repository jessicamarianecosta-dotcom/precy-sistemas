'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { X, Loader2, Copy, Check, ExternalLink, Banknote } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import type { OrderReceivable } from '@/lib/orders/receivables'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function parseBRL(input: string): number {
  const cleaned = input.trim().replace(/\s/g, '').replace(/R\$/i, '')
  if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.'))
  return Number(cleaned)
}

/**
 * "Gerar cobrança" — Financeiro → Contas a Receber.
 * Chama o próprio endpoint autenticado (app/api/pedidos/[id]/cobrancas),
 * que reaproveita a cobrança ativa existente do pedido em vez de criar
 * uma duplicada, e devolve o link público (/loja/cobranca/[token]) já
 * pronto para copiar/compartilhar/baixar o PDF.
 */
export function GerarCobrancaModal({
  receivable,
  onClose,
}: {
  receivable: OrderReceivable
  onClose: () => void
}) {
  const { toast } = useToast()
  const balance = round2(receivable.balance)
  const fmtInput = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const [amountText, setAmountText] = useState(fmtInput(balance))
  const [dueDate, setDueDate] = useState(receivable.dueDate || format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ publicUrl: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const amount = useMemo(() => parseBRL(amountText), [amountText])

  const validationError = useMemo(() => {
    if (!amountText.trim() || Number.isNaN(amount) || amount <= 0) return 'Informe um valor válido para a cobrança.'
    if (round2(amount) > balance + 0.01) return 'Valor não pode ser maior que o saldo pendente.'
    if (!dueDate) return 'Informe a data de vencimento.'
    return null
  }, [amountText, amount, balance, dueDate])

  async function submit() {
    if (validationError || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/pedidos/${receivable.orderId}/cobrancas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: round2(amount), due_date: dueDate, notes: notes.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar cobrança.')
      setResult({ publicUrl: json.public_url })
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setLoading(false)
    }
  }

  const fullUrl = result ? `${window.location.origin}${result.publicUrl}` : ''

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => !loading && onClose()}>
      <div
        className="w-full sm:max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-modal max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2">
            <Banknote size={16} /> Gerar cobrança
          </h3>
          <button onClick={() => !loading && onClose()} className="p-1 rounded-lg text-text-muted hover:bg-stone-100 dark:hover:bg-stone-800">
            <X size={16} />
          </button>
        </div>

        {!result ? (
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between"><span className="text-text-muted">Cliente</span><span className="font-medium text-text-primary dark:text-stone-100">{receivable.customerName || 'Sem cliente'}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Pedido</span><span className="font-mono text-text-muted">{receivable.orderNumber || '—'}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Saldo pendente</span><span className="font-bold text-text-primary dark:text-stone-100">{formatCurrency(balance)}</span></div>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Valor da cobrança</span>
              <div className="mt-1 flex items-center rounded-xl border border-border dark:border-border-dark focus-within:border-primary bg-surface dark:bg-white/5">
                <span className="pl-3 text-sm text-text-muted">R$</span>
                <input
                  inputMode="decimal"
                  value={amountText}
                  onChange={e => setAmountText(e.target.value)}
                  className="w-full bg-transparent px-2 py-2.5 text-sm outline-none text-text-primary dark:text-stone-100"
                  autoFocus
                />
              </div>
              <button type="button" onClick={() => setAmountText(fmtInput(balance))} className="mt-1 text-[11px] text-primary hover:underline">
                Preencher com o saldo total ({formatCurrency(balance)})
              </button>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Vencimento</span>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-primary text-text-primary dark:text-stone-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Observações (opcional)</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-primary text-text-primary dark:text-stone-100"
              />
            </label>

            {validationError && amountText.trim() !== '' && (
              <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
            )}

            <p className="text-[11px] text-text-muted">
              A cobrança usa a chave Pix (CNPJ) cadastrada em Configurações. O pagamento não é confirmado
              automaticamente — você registra o recebimento normalmente quando o dinheiro entrar.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200/50 dark:border-green-800/20 p-3 text-xs text-green-700 dark:text-green-400 font-medium text-center">
              Cobrança gerada com sucesso!
            </div>
            <label className="block">
              <span className="text-xs font-medium text-text-secondary dark:text-stone-400">Link para o cliente</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-white/5 px-3 py-2.5 text-xs font-mono text-text-primary dark:text-stone-100 overflow-x-auto whitespace-nowrap">
                {fullUrl}
              </div>
            </label>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fullUrl)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch { /* ignore */ }
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-border dark:border-border-dark text-text-secondary dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <a
                href={result.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90"
              >
                <ExternalLink size={14} /> Abrir / baixar PDF
              </a>
            </div>
          </div>
        )}

        <div className="flex gap-2 p-4 border-t border-border dark:border-border-dark">
          <button
            onClick={() => !loading && onClose()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border dark:border-border-dark text-text-secondary dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              onClick={submit}
              disabled={!!validationError || loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> Gerando…</> : 'Gerar cobrança'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
