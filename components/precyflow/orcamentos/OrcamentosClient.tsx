'use client'

import { useMemo, useState } from 'react'
import { FileText, Plus, Printer, Loader2, X, ArrowRightCircle } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { formatBRL, formatDateBR } from '@/lib/precyflow/format'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import { printBudget } from '@/lib/precyflow/pdf/printBudget'
import {
  BUDGET_STATUS_LABELS,
  type PrecyFlowBudget, type PrecyFlowBudgetStatus, type PrecyFlowCustomer, type PrecyFlowProduct, type PrecyFlowStore,
} from '@/lib/precyflow/types'

const STATUS_OPTIONS: PrecyFlowBudgetStatus[] = ['rascunho', 'enviado', 'aprovado', 'recusado']

type DraftItem = { product_id: string | null; description: string; image_url: string | null; quantity: number; unit_price: number }

export function OrcamentosClient({
  store,
  initialBudgets,
  customers,
  products,
}: {
  store: PrecyFlowStore
  initialBudgets: PrecyFlowBudget[]
  customers: PrecyFlowCustomer[]
  products: PrecyFlowProduct[]
}) {
  const [budgets, setBudgets] = useState(initialBudgets)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<PrecyFlowBudget | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [conditions, setConditions] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])

  const total = useMemo(() => items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0), [items])

  function openNew() {
    setCustomerId(customers[0]?.id ?? '')
    setValidUntil('')
    setNotes('')
    setConditions('Orçamento válido pelo prazo indicado. Produção inicia após confirmação.')
    setItems([])
    setError(null)
    setShowForm(true)
  }

  function addItem() {
    const first = products[0]
    setItems(prev => [...prev, { product_id: first?.id ?? null, description: first?.name ?? '', image_url: first?.image_url ?? null, quantity: 1, unit_price: first?.price ?? 0 }])
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function onProductChange(index: number, productId: string) {
    const product = products.find(p => p.id === productId)
    updateItem(index, { product_id: productId, description: product?.name ?? '', image_url: product?.image_url ?? null, unit_price: product?.price ?? 0 })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) { setError('Selecione um cliente.'); return }
    if (items.length === 0) { setError('Adicione ao menos um item.'); return }

    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: budget, error: budgetError } = await supabase
        .from('precyflow_budgets')
        .insert({
          store_id: store.id,
          customer_id: customerId,
          valid_until: validUntil || null,
          notes: notes || null,
          conditions: conditions || null,
          subtotal: total,
          total,
        })
        .select('*, customer:precyflow_customers(*)')
        .single()
      if (budgetError) throw budgetError

      const { error: itemsError } = await supabase.from('precyflow_budget_items').insert(
        items.map(it => ({
          budget_id: budget.id,
          product_id: it.product_id,
          description: it.description,
          image_url: it.image_url,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.quantity * it.unit_price,
        }))
      )
      if (itemsError) throw itemsError

      setBudgets(prev => [{ ...(budget as PrecyFlowBudget), items: items.map((it, i) => ({ ...it, id: `tmp-${i}`, budget_id: budget.id, subtotal: it.quantity * it.unit_price, created_at: new Date().toISOString() })) }, ...prev])
      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao criar orçamento.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(budget: PrecyFlowBudget, status: PrecyFlowBudgetStatus) {
    const supabase = createClient()
    const { data: updated, error: updateError } = await supabase
      .from('precyflow_budgets').update({ status }).eq('id', budget.id).select('*, customer:precyflow_customers(*)').single()
    if (!updateError) {
      setBudgets(prev => prev.map(b => (b.id === budget.id ? { ...(updated as PrecyFlowBudget), items: b.items } : b)))
      setDetail(prev => (prev && prev.id === budget.id ? { ...(updated as PrecyFlowBudget), items: prev.items } : prev))
    }
  }

  async function convertToOrder(budget: PrecyFlowBudget) {
    if (!confirm('Converter este orçamento em pedido?')) return
    const supabase = createClient()
    try {
      const { data: order, error: orderError } = await supabase
        .from('precyflow_orders')
        .insert({ store_id: store.id, customer_id: budget.customer_id, subtotal: budget.subtotal, discount: budget.discount, total: budget.total, notes: budget.notes })
        .select()
        .single()
      if (orderError) throw orderError

      const { error: itemsError } = await supabase.from('precyflow_order_items').insert(
        (budget.items ?? []).map(it => ({
          order_id: order.id,
          product_id: it.product_id,
          product_name: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
        }))
      )
      if (itemsError) throw itemsError

      await supabase.from('precyflow_budgets').update({ converted_to_order_id: order.id, status: 'aprovado' }).eq('id', budget.id)
      setBudgets(prev => prev.map(b => (b.id === budget.id ? { ...b, converted_to_order_id: order.id, status: 'aprovado' } : b)))
      setDetail(null)
      alert(`Pedido #${order.order_number} criado a partir do orçamento.`)
    } catch (err: unknown) {
      alert((err as Error).message ?? 'Erro ao converter em pedido.')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Orçamentos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Crie e acompanhe propostas para seus clientes</p>
        </div>
        <button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo orçamento</button>
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        {budgets.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum orçamento ainda" description="Crie um orçamento para enviar ao seu cliente." action={<button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo orçamento</button>} />
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pf-border)' }}>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Orçamento</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Cliente</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Validade</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Status</th>
                  <th className="text-right font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(budget => {
                  const customerName = Array.isArray(budget.customer) ? budget.customer[0]?.name : budget.customer?.name
                  return (
                    <tr key={budget.id} style={{ borderTop: '1px solid var(--pf-border)', cursor: 'pointer' }} onClick={() => setDetail(budget)}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--pf-text)' }}>#{budget.budget_number}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{customerName ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{formatDateBR(budget.valid_until)}</td>
                      <td className="px-4 py-3"><span className="pf-badge pf-badge-primary">{BUDGET_STATUS_LABELS[budget.status]}</span></td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--pf-text)' }}>{formatBRL(budget.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title="Novo orçamento" onClose={() => setShowForm(false)} wide>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Cliente</label>
                <select className="pf-input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Válido até</label>
                <input type="date" className="pf-input" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
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
                      <option value="">Item personalizado</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {!item.product_id && (
                      <input className="pf-input flex-1" placeholder="Descrição" value={item.description} onChange={e => updateItem(index, { description: e.target.value })} />
                    )}
                    <input type="number" min={1} className="pf-input w-20" value={item.quantity} onChange={e => updateItem(index, { quantity: Number(e.target.value) })} />
                    <input type="number" step="0.01" className="pf-input w-28" value={item.unit_price} onChange={e => updateItem(index, { unit_price: Number(e.target.value) })} />
                    <button type="button" onClick={() => removeItem(index)} aria-label="Remover item" style={{ color: 'var(--pf-text-secondary)' }}><X size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Condições</label>
              <textarea className="pf-input" rows={2} value={conditions} onChange={e => setConditions(e.target.value)} />
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
                {saving ? 'Criando...' : 'Criar orçamento'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Orçamento #${detail.budget_number}`} onClose={() => setDetail(null)}>
          <div className="space-y-4">
            <div>
              <span className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Cliente</span>
              <div className="font-medium" style={{ color: 'var(--pf-text)' }}>
                {Array.isArray(detail.customer) ? detail.customer[0]?.name : detail.customer?.name}
              </div>
            </div>

            <div className="space-y-1">
              {(detail.items ?? []).map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--pf-text)' }}>{item.quantity}x {item.description}</span>
                  <span style={{ color: 'var(--pf-text-secondary)' }}>{formatBRL(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--pf-border)' }}>
              <span className="font-semibold" style={{ color: 'var(--pf-text)' }}>Total</span>
              <span className="text-lg font-bold" style={{ color: 'var(--pf-primary)' }}>{formatBRL(detail.total)}</span>
            </div>

            <div>
              <span className="text-xs block mb-2" style={{ color: 'var(--pf-text-secondary)' }}>Status</span>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => changeStatus(detail, s)}
                    className="pf-badge"
                    style={{ backgroundColor: detail.status === s ? 'var(--pf-primary)' : 'var(--pf-bg)', color: detail.status === s ? '#fff' : 'var(--pf-text-secondary)', border: '1px solid var(--pf-border)' }}
                  >
                    {BUDGET_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => printBudget(detail, store)} className="pf-btn-secondary flex-1"><Printer size={16} /> Gerar PDF</button>
              {!detail.converted_to_order_id && (
                <button onClick={() => convertToOrder(detail)} className="pf-btn-primary flex-1"><ArrowRightCircle size={16} /> Converter em pedido</button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
