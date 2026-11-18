'use client'

import { useMemo, useState } from 'react'
import { BarChart2, ShoppingCart, Package, DollarSign } from 'lucide-react'
import { formatBRL } from '@/lib/precyflow/format'
import { EmptyState } from '@/components/precyflow/EmptyState'
import type { PrecyFlowOrder, PrecyFlowOrderItem, PrecyFlowTransaction } from '@/lib/precyflow/types'

type Period = '7d' | '30d' | 'mes' | 'tudo'

function periodStart(period: Period): Date | null {
  const now = new Date()
  if (period === '7d') { const d = new Date(now); d.setDate(d.getDate() - 7); return d }
  if (period === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); return d }
  if (period === 'mes') return new Date(now.getFullYear(), now.getMonth(), 1)
  return null
}

export function RelatoriosClient({
  orders,
  items,
  transactions,
}: {
  orders: PrecyFlowOrder[]
  items: PrecyFlowOrderItem[]
  transactions: PrecyFlowTransaction[]
}) {
  const [period, setPeriod] = useState<Period>('mes')
  const start = periodStart(period)

  const ordersInPeriod = useMemo(
    () => (start ? orders.filter(o => new Date(o.created_at) >= start) : orders),
    [orders, start]
  )

  const orderIdsInPeriod = useMemo(() => new Set(ordersInPeriod.map(o => o.id)), [ordersInPeriod])
  const itemsInPeriod = useMemo(() => items.filter(i => orderIdsInPeriod.has(i.order_id)), [items, orderIdsInPeriod])

  const transactionsInPeriod = useMemo(
    () => (start ? transactions.filter(t => t.payment_date && new Date(t.payment_date) >= start) : transactions),
    [transactions, start]
  )

  const totalVendas = ordersInPeriod.reduce((sum, o) => sum + Number(o.total), 0)
  const totalPedidos = ordersInPeriod.length
  const entradas = transactionsInPeriod.filter(t => t.type === 'entrada' && t.status === 'pago').reduce((s, t) => s + Number(t.amount), 0)
  const saidas = transactionsInPeriod.filter(t => t.type === 'saida' && t.status === 'pago').reduce((s, t) => s + Number(t.amount), 0)

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>()
    for (const item of itemsInPeriod) {
      const current = map.get(item.product_name) ?? { name: item.product_name, quantity: 0, total: 0 }
      current.quantity += Number(item.quantity)
      current.total += Number(item.subtotal)
      map.set(item.product_name, current)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [itemsInPeriod])

  const cards = [
    { label: 'Vendas', value: formatBRL(totalVendas), icon: BarChart2 },
    { label: 'Pedidos', value: String(totalPedidos), icon: ShoppingCart },
    { label: 'Entradas (pago)', value: formatBRL(entradas), icon: DollarSign },
    { label: 'Saídas (pago)', value: formatBRL(saidas), icon: DollarSign },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Relatórios</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Vendas, pedidos, produtos e financeiro por período</p>
        </div>
        <div className="flex gap-2">
          {([['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês'], ['tudo', 'Tudo']] as [Period, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className="pf-badge"
              style={{ backgroundColor: period === value ? 'var(--pf-primary)' : 'var(--pf-bg)', color: period === value ? '#fff' : 'var(--pf-text-secondary)', border: '1px solid var(--pf-border)' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="pf-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--pf-text-secondary)' }}>{label}</span>
              <Icon size={16} style={{ color: 'var(--pf-primary)' }} />
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--pf-text)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="pf-card">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--pf-text)' }}>Produtos mais vendidos</h2>
        {topProducts.length === 0 ? (
          <EmptyState icon={Package} title="Sem dados no período" description="Os produtos mais vendidos aparecem aqui." />
        ) : (
          <div className="space-y-3">
            {topProducts.map(p => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--pf-text)' }}>{p.name}</span>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--pf-text-secondary)' }}>{p.quantity} un.</span>
                  <span className="font-medium" style={{ color: 'var(--pf-text)' }}>{formatBRL(p.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
