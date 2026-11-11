'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { format } from 'date-fns'

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'A confirmar', production: 'Em produção', ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado',
}
const BUDGET_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado', rejected: 'Recusado',
}

function useCustomerDetail(customerId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-cliente-detalhe', customerId],
    queryFn: async () => {
      const [{ data: customer }, { data: orders }, { data: budgets }] = await Promise.all([
        supabase.from('customers').select('id, name, email, phone, notes').eq('id', customerId).single() as any,
        supabase.from('orders').select('id, order_number, status, total, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }) as any,
        supabase.from('budgets').select('id, budget_number, status, total, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }) as any,
      ])
      return { customer, orders: orders ?? [], budgets: budgets ?? [] }
    },
  })
}

export default function PrecyflowClienteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string
  const { companyName } = usePrecyflowCompany()
  const { data, isLoading } = useCustomerDetail(customerId)

  if (isLoading || !data?.customer) {
    return (
      <div>
        <PrecyflowHeader title="Cliente" subtitle={companyName} />
        <div className="p-4 sm:p-6"><div className="pf-card h-64 animate-pulse" /></div>
      </div>
    )
  }

  const { customer, orders, budgets } = data

  return (
    <div>
      <PrecyflowHeader title={customer.name} subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
        <button onClick={() => router.push('/precyflow/app/clientes')} className="flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft size={14} /> Voltar para clientes
        </button>

        <div className="pf-card p-4 space-y-1">
          <p className="font-semibold">{customer.name}</p>
          {customer.phone && <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>{customer.phone}</p>}
          {customer.email && <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>{customer.email}</p>}
          {customer.notes && <p className="text-sm mt-2" style={{ color: 'var(--pf-text-secondary)' }}>{customer.notes}</p>}
        </div>

        <div className="pf-card p-4">
          <p className="text-sm font-semibold mb-3">Pedidos ({orders.length})</p>
          {orders.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--pf-text-muted)' }}>Nenhum pedido ainda.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--pf-border)' }}>
              {orders.map((o: any) => (
                <Link key={o.id} href={`/precyflow/app/pedidos/${o.id}`} className="flex items-center justify-between py-2 text-sm hover:pf-bg-primary-soft rounded-lg px-2 -mx-2">
                  <span>#{o.order_number} · {ORDER_STATUS_LABELS[o.status] ?? o.status} · {format(new Date(o.created_at), 'dd/MM/yyyy')}</span>
                  <span className="font-medium">{formatCurrency(Number(o.total))}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="pf-card p-4">
          <p className="text-sm font-semibold mb-3">Orçamentos ({budgets.length})</p>
          {budgets.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--pf-text-muted)' }}>Nenhum orçamento ainda.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--pf-border)' }}>
              {budgets.map((b: any) => (
                <Link key={b.id} href={`/precyflow/app/orcamentos/${b.id}`} className="flex items-center justify-between py-2 text-sm hover:pf-bg-primary-soft rounded-lg px-2 -mx-2">
                  <span>{b.budget_number} · {BUDGET_STATUS_LABELS[b.status] ?? b.status} · {format(new Date(b.created_at), 'dd/MM/yyyy')}</span>
                  <span className="font-medium">{formatCurrency(Number(b.total))}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
