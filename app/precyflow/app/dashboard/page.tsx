import Link from 'next/link'
import { ShoppingCart, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { getStoreOrRedirect } from '@/lib/precyflow/store'
import { formatBRL, formatDateBR } from '@/lib/precyflow/format'
import { ORDER_STATUS_LABELS, type PrecyFlowOrderStatus } from '@/lib/precyflow/types'
import { WeeklySalesChart } from '@/components/precyflow/dashboard/WeeklySalesChart'
import { EmptyState } from '@/components/precyflow/EmptyState'

export const metadata = { title: 'Dashboard' }

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STATUS_ORDER: PrecyFlowOrderStatus[] = ['a_confirmar', 'em_producao', 'pronto', 'entregue']

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export default async function DashboardPage() {
  const { supabase, store } = await getStoreOrRedirect()

  const today = startOfDay(new Date())
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const [{ data: orders }, { data: transactions }] = await Promise.all([
    supabase
      .from('precyflow_orders')
      .select('id, order_number, status, total, created_at, customer:precyflow_customers(name)')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('precyflow_financial_transactions')
      .select('type, amount, status, payment_date')
      .eq('store_id', store.id)
      .limit(500),
  ])

  const allOrders = (orders ?? []) as Array<{
    id: string; order_number: string; status: PrecyFlowOrderStatus; total: number
    created_at: string; customer: { name: string } | { name: string }[] | null
  }>
  const allTransactions = (transactions ?? []) as Array<{ type: string; amount: number; status: string; payment_date: string | null }>

  const ordersToday = allOrders.filter(o => new Date(o.created_at) >= today).length

  const aReceber = allTransactions
    .filter(t => t.type === 'entrada' && t.status === 'pendente')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const recebidoHoje = allTransactions
    .filter(t => t.type === 'entrada' && t.status === 'pago' && t.payment_date && new Date(t.payment_date) >= today)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const faturamentoMes = allTransactions
    .filter(t => t.type === 'entrada' && t.status === 'pago' && t.payment_date && new Date(t.payment_date) >= monthStart)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const weeklyData = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(sevenDaysAgo)
    day.setDate(day.getDate() + i)
    const dayTotal = allOrders
      .filter(o => {
        const created = new Date(o.created_at)
        return created >= day && created < new Date(day.getTime() + 86400000)
      })
      .reduce((sum, o) => sum + Number(o.total), 0)
    return { label: WEEKDAY_LABELS[day.getDay()], total: dayTotal }
  })

  const statusCounts = STATUS_ORDER.map(status => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    count: allOrders.filter(o => o.status === status).length,
  }))

  const recentOrders = allOrders.slice(0, 5)

  const cards = [
    { label: 'Pedidos hoje', value: String(ordersToday), icon: ShoppingCart },
    { label: 'A receber', value: formatBRL(aReceber), icon: Clock },
    { label: 'Recebido hoje', value: formatBRL(recebidoHoje), icon: CheckCircle2 },
    { label: 'Faturamento do mês', value: formatBRL(faturamentoMes), icon: TrendingUp },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--pf-text)' }}>Bom dia, {store.name}! 👋</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>Aqui está um resumo do seu negócio hoje.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="pf-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--pf-text-secondary)' }}>{label}</span>
              <Icon size={16} style={{ color: 'var(--pf-primary)' }} />
            </div>
            <div className="text-lg lg:text-xl font-bold" style={{ color: 'var(--pf-text)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="pf-card lg:col-span-2">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--pf-text)' }}>Vendas da semana</h2>
          <WeeklySalesChart data={weeklyData} />
        </div>

        <div className="pf-card">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--pf-text)' }}>Pedidos por status</h2>
          <div className="space-y-3">
            {statusCounts.map(({ status, label, count }) => (
              <Link
                key={status}
                href={`/precyflow/app/pedidos?status=${status}`}
                className="flex items-center justify-between text-sm"
              >
                <span style={{ color: 'var(--pf-text-secondary)' }}>{label}</span>
                <span className="font-semibold" style={{ color: 'var(--pf-text)' }}>{count}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="pf-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: 'var(--pf-text)' }}>Pedidos recentes</h2>
          <Link href="/precyflow/app/pedidos" className="text-sm font-medium" style={{ color: 'var(--pf-primary)' }}>Ver todos</Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Nenhum pedido ainda" description="Seus pedidos mais recentes vão aparecer aqui." />
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <tbody>
                {recentOrders.map(order => {
                  const customerName = Array.isArray(order.customer) ? order.customer[0]?.name : order.customer?.name
                  return (
                    <tr key={order.id} className="border-t" style={{ borderColor: 'var(--pf-border)' }}>
                      <td className="py-2.5 pr-4 font-medium" style={{ color: 'var(--pf-text)' }}>#{order.order_number}</td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--pf-text-secondary)' }}>{customerName ?? '—'}</td>
                      <td className="py-2.5 pr-4">
                        <span className="pf-badge pf-badge-primary">{ORDER_STATUS_LABELS[order.status]}</span>
                      </td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--pf-text-secondary)' }}>{formatDateBR(order.created_at)}</td>
                      <td className="py-2.5 text-right font-medium" style={{ color: 'var(--pf-text)' }}>{formatBRL(order.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
