'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Loader2, Copy, Check, ExternalLink, Banknote, Package } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import { WhatsAppShareButton } from '@/components/finance/WhatsAppShareButton'
import { buildCustomerChargeMessage } from '@/lib/orders/whatsapp'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface CustomerChargeOpenOrder {
  orderId: string
  orderNumber: string | null
  serviceName: string | null
  balance: number
  dueDate: string | null
}

/**
 * "Gerar aviso de cobrança" — ficha do Cliente → aba Financeiro.
 * Soma o saldo em aberto dos pedidos selecionados (todos, por padrão)
 * num único aviso/Pix, via app/api/clientes/[id]/cobranca — o mesmo
 * endpoint reaproveita (nunca duplica) a cobrança agregada ativa do
 * cliente, atualizando valor/pedidos/vencimento no mesmo link público
 * quando gerada de novo.
 */
export function GerarCobrancaClienteModal({
  customer,
  openOrders,
  onClose,
}: {
  customer: { id: string; name: string; phone: string | null }
  openOrders: CustomerChargeOpenOrder[]
  onClose: () => void
}) {
  const { toast } = useToast()

  const [selected, setSelected] = useState<Set<string>>(() => new Set(openOrders.map(o => o.orderId)))
  const earliestDue = useMemo(
    () => openOrders.map(o => o.dueDate).filter(Boolean).sort()[0] as string | undefined,
    [openOrders],
  )
  const [dueDate, setDueDate] = useState(earliestDue || format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ publicUrl: string; customerPhone: string | null; amountDue: number; orderCount: number } | null>(null)
  const [copied, setCopied] = useState(false)

  const totalSelected = useMemo(
    () => round2(openOrders.filter(o => selected.has(o.orderId)).reduce((s, o) => s + o.balance, 0)),
    [openOrders, selected],
  )

  function toggle(orderId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const validationError = useMemo(() => {
    if (selected.size === 0) return 'Selecione pelo menos um pedido para incluir no aviso.'
    if (!dueDate) return 'Informe a data de vencimento.'
    return null
  }, [selected, dueDate])

  async function submit() {
    if (validationError || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/clientes/${customer.id}/cobranca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: dueDate, notes: notes.trim() || null, order_ids: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar cobrança.')
      setResult({
        publicUrl: json.public_url,
        customerPhone: json.customer?.phone ?? customer.phone ?? null,
        amountDue: Number(json.display?.amountDue ?? totalSelected),
        orderCount: selected.size,
      })
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
            <Banknote size={16} /> Gerar aviso de cobrança
          </h3>
          <button onClick={() => !loading && onClose()} className="p-1 rounded-lg text-text-muted hover:bg-stone-100 dark:hover:bg-stone-800">
            <X size={16} />
          </button>
        </div>

        {!result ? (
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between"><span className="text-text-muted">Cliente</span><span className="font-medium text-text-primary dark:text-stone-100">{customer.name}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Telefone</span><span className="text-text-primary dark:text-stone-100">{customer.phone || 'Não cadastrado'}</span></div>
              <div className="pt-1.5 border-t border-border dark:border-border-dark flex items-center justify-between">
                <span className="text-text-muted">Total selecionado</span>
                <span className="font-bold text-text-primary dark:text-stone-100">{formatCurrency(totalSelected)}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-text-secondary dark:text-stone-400 flex items-center gap-1.5 mb-1.5">
                <Package size={13} /> Pedidos incluídos no aviso
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {openOrders.map(o => (
                  <label
                    key={o.orderId}
                    className={[
                      'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer transition-colors',
                      selected.has(o.orderId) ? 'border-primary bg-primary-50 dark:bg-primary/10' : 'border-border dark:border-border-dark',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected.has(o.orderId)}
                        onChange={() => toggle(o.orderId)}
                        className="flex-shrink-0"
                      />
                      <span className="min-w-0 truncate text-text-primary dark:text-stone-100">
                        {o.orderNumber ?? '—'}{o.serviceName ? ` · ${o.serviceName}` : ''}
                        {o.dueDate && <span className="text-text-muted"> · vence {format(new Date(o.dueDate + 'T00:00:00'), 'dd/MM', { locale: ptBR })}</span>}
                      </span>
                    </span>
                    <span className="font-semibold text-text-primary dark:text-stone-100 flex-shrink-0">{formatCurrency(o.balance)}</span>
                  </label>
                ))}
              </div>
            </div>

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

            {validationError && (
              <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
            )}

            <p className="text-[11px] text-text-muted">
              A cobrança usa a chave Pix cadastrada em Configurações. O pagamento não é confirmado
              automaticamente — o recebimento de cada pedido continua sendo registrado normalmente no Financeiro.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200/50 dark:border-green-800/20 p-3 text-xs text-green-700 dark:text-green-400 font-medium text-center">
              Aviso de cobrança gerado com sucesso! {formatCurrency(result.amountDue)} · {result.orderCount === 1 ? '1 pedido' : `${result.orderCount} pedidos`}
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
            <WhatsAppShareButton
              phone={result.customerPhone}
              message={buildCustomerChargeMessage({
                customerName: customer.name || 'Cliente',
                orderCount: result.orderCount,
                amountDue: result.amountDue,
                dueDate,
                publicUrl: fullUrl,
              })}
            />
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
