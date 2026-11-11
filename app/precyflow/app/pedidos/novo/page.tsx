'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'

interface CartItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
}

function useProductsAndCustomers(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-pedido-novo-refs', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [{ data: products }, { data: customers }] = await Promise.all([
        supabase.from('products').select('id, name, final_price').eq('company_id', companyId as string).eq('is_active', true).order('name') as any,
        supabase.from('customers').select('id, name').eq('company_id', companyId as string).order('name') as any,
      ])
      return { products: products ?? [], customers: customers ?? [] }
    },
  })
}

export default function PrecyflowNovoPedidoPage() {
  const router = useRouter()
  const { companyId, companyName } = usePrecyflowCompany()
  const { data } = useProductsAndCustomers(companyId)
  const supabase = createClient()

  const [customerId, setCustomerId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [productToAdd, setProductToAdd] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  function addItem() {
    const product = (data?.products ?? []).find((p: any) => p.id === productToAdd)
    if (!product) return
    setCart(c => {
      const existing = c.find(i => i.productId === product.id)
      if (existing) return c.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...c, { productId: product.id, name: product.name, unitPrice: Number(product.final_price), quantity: 1 }]
    })
  }

  function updateQty(productId: string, quantity: number) {
    setCart(c => c.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i))
  }

  function removeItem(productId: string) {
    setCart(c => c.filter(i => i.productId !== productId))
  }

  async function handleSubmit() {
    if (!companyId) return
    if (!customerId) { setError('Selecione um cliente.'); return }
    if (cart.length === 0) { setError('Adicione ao menos um item ao pedido.'); return }

    setSaving(true)
    setError(null)
    try {
      const { data: order, error: orderErr } = await (supabase.from('orders') as any).insert({
        company_id: companyId,
        customer_id: customerId,
        order_number: '',
        status: 'pending',
        payment_status: 'pending',
        subtotal: total,
        discount: 0,
        total,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      }).select('id').single() as any
      if (orderErr) throw orderErr

      const items = cart.map(i => ({
        order_id: order.id, product_id: i.productId, name: i.name,
        quantity: i.quantity, unit_price: i.unitPrice, subtotal: i.unitPrice * i.quantity,
      }))
      const { error: itemsErr } = await (supabase.from('order_items') as any).insert(items)
      if (itemsErr) throw itemsErr

      router.push(`/precyflow/app/pedidos/${order.id}`)
    } catch {
      setError('Não foi possível criar o pedido. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PrecyflowHeader title="Novo pedido" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
        <button onClick={() => router.push('/precyflow/app/pedidos')} className="flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft size={14} /> Voltar
        </button>

        <div className="pf-card p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Cliente</label>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Selecione um cliente</option>
              {(data?.customers ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!data?.customers?.length && (
              <p className="text-xs mt-1" style={{ color: 'var(--pf-text-muted)' }}>Nenhum cliente cadastrado ainda.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Prazo de entrega (opcional)</label>
            <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Observações (opcional)</label>
            <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="pf-card p-4 space-y-3">
          <p className="text-sm font-semibold">Itens do pedido</p>
          <div className="flex gap-2">
            <select className="input flex-1" value={productToAdd} onChange={e => setProductToAdd(e.target.value)}>
              <option value="">Selecione um produto</option>
              {(data?.products ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} — {formatCurrency(Number(p.final_price))}</option>
              ))}
            </select>
            <button onClick={addItem} className="pf-btn-primary px-3 flex items-center gap-1"><Plus size={16} /></button>
          </div>

          {cart.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--pf-text-muted)' }}>Nenhum item adicionado.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--pf-border)' }}>
              {cart.map(item => (
                <div key={item.productId} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1 truncate">{item.name}</span>
                  <input
                    type="number" min={1} value={item.quantity}
                    onChange={e => updateQty(item.productId, Number(e.target.value))}
                    className="input w-16 text-center py-1"
                  />
                  <span className="w-24 text-right font-medium">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  <button onClick={() => removeItem(item.productId)} className="text-error p-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3 flex justify-between font-bold text-base" style={{ borderColor: 'var(--pf-border)' }}>
            <span>Total</span><span>{formatCurrency(total)}</span>
          </div>
        </div>

        {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}

        <button onClick={handleSubmit} disabled={saving} className="pf-btn-primary w-full py-3">
          {saving ? 'Criando pedido...' : 'Criar pedido'}
        </button>
      </div>
    </div>
  )
}
