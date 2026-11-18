'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShoppingCart, Plus, LayoutGrid, List as ListIcon, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { formatBRL, formatDateBR } from '@/lib/precyflow/format'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import { ORDER_STATUS_LABELS, type PrecyFlowCustomer, type PrecyFlowOrder, type PrecyFlowOrderStatus, type PrecyFlowProduct } from '@/lib/precyflow/types'

const STATUS_COLUMNS: PrecyFlowOrderStatus[] = ['a_confirmar', 'em_producao', 'pronto', 'entregue']

type DraftItem = { product_id: string | null; product_name: string; quantity: number; unit_price: number }

export function PedidosClient({
  storeId,
  initialOrders,
  customers,
  products,
}: {
  storeId: string
  initialOrders: PrecyFlowOrder[]
  customers: PrecyFlowCustomer[]
  products: PrecyFlowProduct[]
}) {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') as PrecyFlowOrderStatus | null

  const [orders, setOrders] = useState(initialOrders)
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [listFilter, setListFilter] = useState<PrecyFlowOrderStatus | 'todos'>(initialStatus ?? 'todos')
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<PrecyFlowOrder | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])

  const grouped = useMemo(() => {
    const map = new Map<PrecyFlowOrderStatus, PrecyFlowOrder[]>()
    for (const s of STATUS_COLUMNS) map.set(s, [])
    for (const o of orders) map.get(o.status)?.push(o)
    return map
  }, [orders])

  const listOrders = useMemo(
    () => (listFilter === 'todos' ? orders : orders.filter(o => o.status === listFilter)),
    [orders, listFilter]
  )

  function openNew() {
    setCustomerId(customers[0]?.id ?? '')
    setDueDate('')
    setNotes('')
    setItems([])
    setError(null)
    setShowForm(true)
  }

  function addItem() {
    const first = products[0]
    setItems(prev => [...prev, { product_id: first?.id ?? null, product_name: first?.name ?? '', quantity: 1, unit_price: first?.price ?? 0 }])
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function onProductChange(index: number, productId: string) {
    const product = products.find(p => p.id === productId)
    updateItem(index, { product_id: productId, product_name: product?.name ?? '', unit_price: product?.price ?? 0 })
  }

  const total = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) { setError('Selecione um cliente.'); return }
    if (items.length === 0) { setError('Adicione ao menos um item.'); return }

    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: order, error: orderError } = await supabase
        .from('precyflow_orders')
        .insert({
          store_id: storeId,
          customer_id: customerId,
          due_date: dueDate || null,
          notes: notes || null,
          subtotal: total,
          total,
          origin: 'manual',
        })
        .select('*, customer:precyflow_customers(*)')
        .single()
      if (orderError) throw orderError

      const { error: itemsError } = await supabase.from('precyflow_order_items').insert(
        items.map(it => ({
          order_id: order.id,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.quantity * it.unit_price,
        }))
      )
      if (itemsError) throw itemsError

      setOrders(prev => [{ ...(order as PrecyFlowOrder), items: items.map((it, i) => ({ ...it, id: `tmp-${i}`, order_id: order.id, subtotal: it.quantity * it.unit_price, created_at: new Date().toISOString() })) }, ...prev])
      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao criar pedido.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(order: PrecyFlowOrder, status: PrecyFlowOrderStatus) {
    const supabase = createClient()
    const { data: updated, error: updateError } = await supabase
      .from('precyflow_orders').update({ status }).eq('id', order.id).select('*, customer:precyflow_customers(*)').single()
    if (!updateError) {
      setOrders(prev => prev.map(o => (o.id === order.id ? { ...(updated as PrecyFlowOrder), items: o.items } : o)))
      setDetail(prev => (prev && prev.id === order.id ? { ...(updated as PrecyFlowOrder), items: prev.items } : prev))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Pedidos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Acompanhe cada pedido do início ao fim</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--pf-border)' }}>
            <button
              onClick={() => setView('kanban')}
              className="px-3 py-2"
              style={{ backgroundColor: view === 'kanban' ? 'var(--pf-primary)' : 'transparent', color: view === 'kanban' ? '#fff' : 'var(--pf-text-secondary)' }}
              aria-label="Kanban"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView('lista')}
              className="px-3 py-2"
              style={{ backgroundColor: view === 'lista' ? 'var(--pf-primary)' : 'transparent', color: view === 'lista' ? '#fff' : 'var(--pf-text-secondary)' }}
              aria-label="Lista"
            >
              <ListIcon size={16} />
            </button>
          </div>
          <button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo pedido</button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="pf-card">
          <EmptyState icon={ShoppingCart} title="Nenhum pedido ainda" description="Crie seu primeiro pedido para começar a acompanhar a produção." action={<button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo pedido</button>} />
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map(status => (
            <div key={status} className="pf-card !p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--pf-text)' }}>{ORDER_STATUS_LABELS[status]}</h3>
                <span className="pf-badge pf-badge-muted">{grouped.get(status)?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(grouped.get(status) ?? []).map(order => {
                  const customerName = Array.isArray(order.customer) ? order.customer[0]?.name : order.customer?.name
                  return (
                    <button
                      key={order.id}
                      onClick={() => setDetail(order)}
                      className="pf-card !p-3 w-full text-left"
                      style={{ backgroundColor: 'var(--pf-bg)' }}
                    >
                      <div className="text-sm font-medium" style={{ color: 'var(--pf-text)' }}>#{order.order_number}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--pf-text-secondary)' }}>{customerName ?? '—'}</div>
                      <div className="text-sm font-semibold mt-1.5" style={{ color: 'var(--pf-primary)' }}>{formatBRL(order.total)}</div>
                    </button>
                  )
                })}
                {(grouped.get(status) ?? []).length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--pf-text-muted)' }}>Sem pedidos</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setListFilter('todos')} className="pf-badge" style={{ backgroundColor: listFilter === 'todos' ? 'var(--pf-primary)' : 'var(--pf-bg)', color: listFilter === 'todos' ? '#fff' : 'var(--pf-text-secondary)', border: '1px solid var(--pf-border)' }}>Todos</button>
            {STATUS_COLUMNS.map(s => (
              <button key={s} onClick={() => setListFilter(s)} className="pf-badge" style={{ backgroundColor: listFilter === s ? 'var(--pf-primary)' : 'var(--pf-bg)', color: listFilter === s ? '#fff' : 'var(--pf-text-secondary)', border: '1px solid var(--pf-border)' }}>
                {ORDER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="pf-card !p-0 overflow-hidden">
            <div className="table-responsive">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--pf-border)' }}>
                    <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Pedido</th>
                    <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Cliente</th>
                    <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Prazo</th>
                    <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Status</th>
                    <th className="text-right font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {listOrders.map(order => {
                    const customerName = Array.isArray(order.customer) ? order.customer[0]?.name : order.customer?.name
                    return (
                      <tr key={order.id} style={{ borderTop: '1px solid var(--pf-border)', cursor: 'pointer' }} onClick={() => setDetail(order)}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--pf-text)' }}>#{order.order_number}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{customerName ?? '—'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{formatDateBR(order.due_date)}</td>
                        <td className="px-4 py-3"><span className="pf-badge pf-badge-primary">{ORDER_STATUS_LABELS[order.status]}</span></td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--pf-text)' }}>{formatBRL(order.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title="Novo pedido" onClose={() => setShowForm(false)} wide>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Cliente</label>
                <select className="pf-input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {customers.length === 0 && <p className="mt-1 text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Cadastre um cliente primeiro.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Prazo de entrega</label>
                <input type="date" className="pf-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--pf-text)' }}>Itens</label>
                <button type="button" onClick={addItem} className="text-sm font-medium" style={{ color: 'var(--pf-primary)' }}>+ Adicionar item</button>
              </div>

              {items.length === 0 && <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>Nenhum item adicionado.</p>}

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select className="pf-input flex-1" value={item.product_id ?? ''} onChange={e => onProductChange(index, e.target.value)}>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" min={1} className="pf-input w-20" value={item.quantity} onChange={e => updateItem(index, { quantity: Number(e.target.value) })} />
                    <input type="number" step="0.01" className="pf-input w-28" value={item.unit_price} onChange={e => updateItem(index, { unit_price: Number(e.target.value) })} />
                    <button type="button" onClick={() => removeItem(index)} aria-label="Remover item" style={{ color: 'var(--pf-text-secondary)' }}><X size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Observações</label>
              <textarea className="pf-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--pf-border)' }}>
              <span className="font-semibold" style={{ color: 'var(--pf-text)' }}>Total</span>
              <span className="text-lg font-bold" style={{ color: 'var(--pf-primary)' }}>{formatBRL(total)}</span>
            </div>

            {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>{error}</div>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="pf-btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={saving} className="pf-btn-primary flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Criando...' : 'Criar pedido'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Pedido #${detail.order_number}`} onClose={() => setDetail(null)}>
          <div className="space-y-4">
            <div>
              <span className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Cliente</span>
              <div className="font-medium" style={{ color: 'var(--pf-text)' }}>
                {Array.isArray(detail.customer) ? detail.customer[0]?.name : detail.customer?.name}
              </div>
            </div>

            <div>
              <span className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Itens</span>
              <div className="space-y-1 mt-1">
                {(detail.items ?? []).map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span style={{ color: 'var(--pf-text)' }}>{item.quantity}x {item.product_name}</span>
                    <span style={{ color: 'var(--pf-text-secondary)' }}>{formatBRL(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--pf-border)' }}>
              <span className="font-semibold" style={{ color: 'var(--pf-text)' }}>Total</span>
              <span className="text-lg font-bold" style={{ color: 'var(--pf-primary)' }}>{formatBRL(detail.total)}</span>
            </div>

            <div>
              <span className="text-xs block mb-2" style={{ color: 'var(--pf-text-secondary)' }}>Status</span>
              <div className="flex flex-wrap gap-2">
                {STATUS_COLUMNS.map(s => (
                  <button
                    key={s}
                    onClick={() => changeStatus(detail, s)}
                    className="pf-badge"
                    style={{
                      backgroundColor: detail.status === s ? 'var(--pf-primary)' : 'var(--pf-bg)',
                      color: detail.status === s ? '#fff' : 'var(--pf-text-secondary)',
                      border: '1px solid var(--pf-border)',
                    }}
                  >
                    {ORDER_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {detail.notes && (
              <div>
                <span className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Observações</span>
                <p className="text-sm mt-1" style={{ color: 'var(--pf-text)' }}>{detail.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
