'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { format } from 'date-fns'

const STATUS_ORDER = ['pending', 'production', 'ready', 'delivered', 'cancelled'] as const
const STATUS_LABELS: Record<string, string> = {
  pending: 'A confirmar', production: 'Em produção', ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado',
}

function useOrder(orderId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-pedido', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders')
        .select('id, order_number, status, subtotal, discount, total, notes, due_date, created_at, customer_id, customers(name, phone, email), order_items(id, name, quantity, unit_price, subtotal)')
        .eq('id', orderId).single() as any
      if (error) throw error
      return data
    },
  })
}

export default function PrecyflowPedidoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const { companyName } = usePrecyflowCompany()
  const { data: order, isLoading } = useOrder(orderId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  async function changeStatus(status: string) {
    await (supabase.from('orders') as any).update({ status }).eq('id', orderId)
    queryClient.invalidateQueries({ queryKey: ['precyflow-pedido', orderId] })
    queryClient.invalidateQueries({ queryKey: ['precyflow-pedidos'] })
  }

  if (isLoading || !order) {
    return (
      <div>
        <PrecyflowHeader title="Pedido" subtitle={companyName} />
        <div className="p-4 sm:p-6"><div className="pf-card h-64 animate-pulse" /></div>
      </div>
    )
  }

  return (
    <div>
      <PrecyflowHeader title={`Pedido #${order.order_number}`} subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
        <button onClick={() => router.push('/precyflow/app/pedidos')} className="flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft size={14} /> Voltar para pedidos
        </button>

        <div className="pf-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold">{order.customers?.name ?? 'Cliente'}</p>
              <p className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>
                {order.customers?.phone ?? order.customers?.email ?? ''}
              </p>
            </div>
            <select value={order.status} onChange={e => changeStatus(e.target.value)} className="input w-44 text-sm">
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
            Criado em {format(new Date(order.created_at), 'dd/MM/yyyy')}
            {order.due_date && ` · Prazo: ${format(new Date(order.due_date), 'dd/MM/yyyy')}`}
          </div>
        </div>

        <div className="pf-card p-4">
          <p className="text-sm font-semibold mb-3">Itens</p>
          <div className="divide-y" style={{ borderColor: 'var(--pf-border)' }}>
            {(order.order_items ?? []).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span>{item.name ?? 'Item'} × {item.quantity}</span>
                <span className="font-medium">{formatCurrency(Number(item.subtotal))}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm" style={{ borderColor: 'var(--pf-border)' }}>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(order.subtotal))}</span></div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between"><span>Desconto</span><span>-{formatCurrency(Number(order.discount))}</span></div>
            )}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(Number(order.total))}</span></div>
          </div>
        </div>

        {order.notes && (
          <div className="pf-card p-4">
            <p className="text-sm font-semibold mb-1">Observações</p>
            <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
