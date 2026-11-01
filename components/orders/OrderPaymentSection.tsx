'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, QrCode, Loader2, RotateCcw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { useToast } from '@/components/ui/Toaster'

interface PaymentRow {
  id: string
  payment_method: 'pix' | 'credit_card'
  installments: number
  status: string
  amount: number
  net_amount: number
  fee_amount: number
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', in_process: 'Em análise', approved: 'Aprovado',
  rejected: 'Recusado', cancelled: 'Cancelado', refunded: 'Reembolsado', expired: 'Expirado',
}

/**
 * Detalhe técnico do pagamento de um pedido do Catálogo Online — forma,
 * parcelas, taxa retida e valor líquido estimado — complementa (não
 * substitui) o card "Entrega — Catálogo Online" já existente no pedido.
 * Só é exibido para pedidos com source='catalog' (controlado pelo chamador).
 */
export function OrderPaymentSection({ orderId, companyId }: { orderId: string; companyId: string }) {
  const supabase = createClient()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: payments, isLoading } = useQuery<PaymentRow[]>({
    queryKey: ['order-payments', orderId],
    queryFn: async () => {
      const { data } = await (supabase.from('payments') as any)
        .select('id, payment_method, installments, status, amount, net_amount, fee_amount, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const refundMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/loja/pagamentos/reembolsar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao reembolsar')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-payments', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      toast('success', 'Reembolso solicitado ao Mercado Pago.')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  if (isLoading) return null
  const latest = payments?.[0]
  if (!latest) return null

  const Icon = latest.payment_method === 'pix' ? QrCode : CreditCard
  const canRefund = latest.status === 'approved'

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
        <Icon size={12} /> Pagamento — Catálogo Online
      </h3>
      <div className="rounded-xl border border-border dark:border-border-dark p-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
        <div><span className="text-text-muted">Forma: </span><b className="text-text-primary dark:text-stone-100">{latest.payment_method === 'pix' ? 'Pix' : `Cartão ${latest.installments}x`}</b></div>
        <div><span className="text-text-muted">Status: </span><b className="text-text-primary dark:text-stone-100">{STATUS_LABELS[latest.status] ?? latest.status}</b></div>
        <div><span className="text-text-muted">Cobrado do cliente: </span><b className="text-text-primary dark:text-stone-100">{formatCurrency(latest.amount)}</b></div>
        <div><span className="text-text-muted">Taxa: </span><b className="text-text-primary dark:text-stone-100">{formatCurrency(latest.fee_amount)}</b></div>
        <div className="col-span-2 sm:col-span-4"><span className="text-text-muted">Valor líquido estimado: </span><b className="text-text-primary dark:text-stone-100">{formatCurrency(latest.net_amount)}</b></div>
      </div>
      {canRefund && (
        <button
          type="button"
          onClick={() => { if (confirm('Reembolsar este pagamento no Mercado Pago? Essa ação não pode ser desfeita.')) refundMutation.mutate() }}
          disabled={refundMutation.isPending}
          className="text-xs flex items-center gap-1.5 text-error hover:underline disabled:opacity-50"
        >
          {refundMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          Reembolsar pagamento
        </button>
      )}
    </section>
  )
}
