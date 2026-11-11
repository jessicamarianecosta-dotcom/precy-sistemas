'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ShoppingCart, LayoutGrid, List as ListIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_ORDER = ['pending', 'production', 'ready', 'delivered'] as const
const STATUS_LABELS: Record<string, string> = {
  pending: 'A confirmar', production: 'Em produção', ready: 'Pronto', delivered: 'Entregue',
}

interface Order {
  id: string
  order_number: string
  status: string
  total: number
  due_date: string | null
  created_at: string
  customers: { name: string } | null
}

function useOrders(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-pedidos', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('orders')
        .select('id, order_number, status, total, due_date, created_at, customers(name)')
        .eq('company_id', companyId as string)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }) as any
      if (error) throw error
      return (data ?? []) as Order[]
    },
  })
}

export default function PrecyflowPedidosPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: orders, isLoading } = useOrders(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')

  async function changeStatus(orderId: string, status: string) {
    await (supabase.from('orders') as any).update({ status }).eq('id', orderId)
    queryClient.invalidateQueries({ queryKey: ['precyflow-pedidos', companyId] })
    queryClient.invalidateQueries({ queryKey: ['precyflow-dashboard', companyId] })
  }

  return (
    <div>
      <PrecyflowHeader title="Pedidos" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="pf-card inline-flex p-1 gap-1">
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${view === 'kanban' ? 'pf-btn-primary' : ''}`}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
            <button
              onClick={() => setView('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${view === 'lista' ? 'pf-btn-primary' : ''}`}
            >
              <ListIcon size={14} /> Lista
            </button>
          </div>
          <Link href="/precyflow/app/pedidos/novo" className="pf-btn-primary flex items-center gap-2 px-4 py-2.5">
            <Plus size={16} /> Novo pedido
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pf-card h-40 animate-pulse" />)}
          </div>
        ) : !orders?.length ? (
          <div className="pf-card">
            <PrecyflowEmptyState
              icon={ShoppingCart}
              title="Nenhum pedido ainda"
              subtitle="Pedidos criados pela loja ou cadastrados manualmente aparecem aqui."
              action={<Link href="/precyflow/app/pedidos/novo" className="pf-btn-primary px-4 py-2 inline-block">Novo pedido</Link>}
            />
          </div>
        ) : view === 'kanban' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STATUS_ORDER.map(status => {
              const items = orders.filter(o => o.status === status)
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm font-semibold">{STATUS_LABELS[status]}</p>
                    <span className="text-xs" style={{ color: 'var(--pf-text-muted)' }}>{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(o => (
                      <div key={o.id} className="pf-card p-3">
                        <Link href={`/precyflow/app/pedidos/${o.id}`} className="block">
                          <p className="text-sm font-semibold">Pedido #{o.order_number}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--pf-text-secondary)' }}>{o.customers?.name ?? 'Cliente'}</p>
                          <p className="text-sm font-bold mt-1.5">{formatCurrency(Number(o.total))}</p>
                          {o.due_date && (
                            <p className="text-xs mt-1" style={{ color: 'var(--pf-text-muted)' }}>
                              Prazo: {format(new Date(o.due_date), "dd 'de' MMM", { locale: ptBR })}
                            </p>
                          )}
                        </Link>
                        <select
                          value={o.status}
                          onChange={e => changeStatus(o.id, e.target.value)}
                          className="input mt-2 text-xs py-1.5"
                        >
                          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="pf-card p-4 text-center text-xs" style={{ color: 'var(--pf-text-muted)' }}>Nenhum pedido</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="pf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Prazo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                    <td className="px-4 py-3">
                      <Link href={`/precyflow/app/pedidos/${o.id}`} className="font-medium hover:underline">#{o.order_number}</Link>
                    </td>
                    <td className="px-4 py-3">{o.customers?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(o.total))}</td>
                    <td className="px-4 py-3">{o.due_date ? format(new Date(o.due_date), 'dd/MM/yyyy') : '—'}</td>
                    <td className="px-4 py-3">
                      <select value={o.status} onChange={e => changeStatus(o.id, e.target.value)} className="input text-xs py-1.5 w-36">
                        {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
