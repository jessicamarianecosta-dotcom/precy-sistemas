'use client'

import { useMemo, useState } from 'react'
import { ShoppingCart, Plus, Minus, X, ArrowLeft, CheckCircle2, Loader2, Phone, Mail } from 'lucide-react'
import { formatBRL } from '@/lib/precyflow/format'
import { Logo } from '@/components/precyflow/Logo'
import { Mascot } from '@/components/precyflow/Mascot'
import type { PrecyFlowProduct, PrecyFlowStore } from '@/lib/precyflow/types'

type CartLine = { product: PrecyFlowProduct; quantity: number }

export function LojaClient({ store, products }: { store: PrecyFlowStore; products: PrecyFlowProduct[] }) {
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map())
  const [step, setStep] = useState<'loja' | 'checkout' | 'sucesso'>('loja')
  const [showCart, setShowCart] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const lines = Array.from(cart.values())
  const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0)
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)

  function addToCart(product: PrecyFlowProduct) {
    setCart(prev => {
      const next = new Map(prev)
      const existing = next.get(product.id)
      next.set(product.id, { product, quantity: (existing?.quantity ?? 0) + 1 })
      return next
    })
  }

  function updateQuantity(productId: string, delta: number) {
    setCart(prev => {
      const next = new Map(prev)
      const existing = next.get(productId)
      if (!existing) return prev
      const quantity = existing.quantity + delta
      if (quantity <= 0) next.delete(productId)
      else next.set(productId, { ...existing, quantity })
      return next
    })
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) { setError('Informe nome e telefone.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/precyflow/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: store.id,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          address,
          notes,
          items: lines.map(l => ({ product_id: l.product.id, quantity: l.quantity })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao enviar pedido.')
      setOrderNumber(json.order_number)
      setStep('sucesso')
      setCart(new Map())
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao enviar pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'sucesso') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="pf-card max-w-sm w-full text-center">
          <CheckCircle2 size={48} style={{ color: 'var(--pf-success)' }} className="mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--pf-text)' }}>Pedido enviado!</h1>
          <p className="text-sm mb-1" style={{ color: 'var(--pf-text-secondary)' }}>Pedido #{orderNumber}</p>
          <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>{store.name} vai entrar em contato para confirmar.</p>
          <button onClick={() => setStep('loja')} className="pf-btn-primary w-full">Voltar para a loja</button>
        </div>
      </div>
    )
  }

  if (step === 'checkout') {
    return (
      <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
        <button onClick={() => setStep('loja')} className="flex items-center gap-1 text-sm mb-4" style={{ color: 'var(--pf-text-secondary)' }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--pf-text)' }}>Finalizar pedido</h1>

        <div className="pf-card mb-4">
          {lines.map(l => (
            <div key={l.product.id} className="flex justify-between text-sm mb-2">
              <span style={{ color: 'var(--pf-text)' }}>{l.quantity}x {l.product.name}</span>
              <span style={{ color: 'var(--pf-text-secondary)' }}>{formatBRL(l.product.price * l.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-2 border-t font-semibold" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text)' }}>
            <span>Total</span>
            <span style={{ color: 'var(--pf-primary)' }}>{formatBRL(total)}</span>
          </div>
        </div>

        <form onSubmit={submitOrder} className="pf-card space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Seu nome</label>
            <input className="pf-input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Telefone/WhatsApp</label>
            <input className="pf-input" value={phone} onChange={e => setPhone(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>E-mail (opcional)</label>
            <input type="email" className="pf-input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Endereço de entrega (opcional)</label>
            <input className="pf-input" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Observações</label>
            <textarea className="pf-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>{error}</div>}

          <button type="submit" disabled={submitting} className="pf-btn-primary w-full">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? 'Enviando...' : 'Confirmar pedido'}
          </button>
          <p className="text-xs text-center" style={{ color: 'var(--pf-text-muted)' }}>Pagamento combinado diretamente com a loja.</p>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-4 py-4 sticky top-0 z-20" style={{ backgroundColor: 'var(--pf-surface)', borderBottom: '1px solid var(--pf-border)' }}>
        <div className="flex items-center gap-2">
          {store.theme === 'cat' && <Mascot size={32} />}
          <div>
            <div className="font-bold" style={{ color: 'var(--pf-text)' }}>{store.name}</div>
            {store.description && <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>{store.description}</div>}
          </div>
        </div>
        <button onClick={() => setShowCart(true)} className="relative pf-btn-secondary !px-3">
          <ShoppingCart size={18} />
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 text-xs rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: 'var(--pf-primary)', color: '#fff' }}>
              {itemCount}
            </span>
          )}
        </button>
      </header>

      <main className="px-4 py-6 max-w-5xl mx-auto">
        {(store.contact_phone || store.contact_email) && (
          <div className="flex flex-wrap gap-4 mb-5 text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
            {store.contact_phone && <span className="flex items-center gap-1"><Phone size={14} /> {store.contact_phone}</span>}
            {store.contact_email && <span className="flex items-center gap-1"><Mail size={14} /> {store.contact_email}</span>}
          </div>
        )}

        {products.length === 0 ? (
          <div className="pf-card text-center py-16">
            <p style={{ color: 'var(--pf-text-secondary)' }}>Nenhum produto disponível no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => (
              <div key={product.id} className="pf-card !p-3">
                <div className="aspect-square rounded-xl mb-2 flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--pf-bg)' }}>
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🎀</span>
                  )}
                </div>
                <div className="text-sm font-medium truncate" style={{ color: 'var(--pf-text)' }}>{product.name}</div>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--pf-primary)' }}>{formatBRL(product.price)}</div>
                <button onClick={() => addToCart(product)} className="pf-btn-primary w-full !py-2 text-xs">
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative w-full max-w-sm h-full flex flex-col" style={{ backgroundColor: 'var(--pf-surface)' }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid var(--pf-border)' }}>
              <h2 className="font-bold" style={{ color: 'var(--pf-text)' }}>Seu carrinho</h2>
              <button onClick={() => setShowCart(false)} aria-label="Fechar" style={{ color: 'var(--pf-text-secondary)' }}><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {lines.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: 'var(--pf-text-secondary)' }}>Carrinho vazio</p>
              ) : (
                lines.map(l => (
                  <div key={l.product.id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--pf-text)' }}>{l.product.name}</div>
                      <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>{formatBRL(l.product.price)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(l.product.id, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ border: '1px solid var(--pf-border)' }}><Minus size={14} /></button>
                      <span className="text-sm w-5 text-center" style={{ color: 'var(--pf-text)' }}>{l.quantity}</span>
                      <button onClick={() => updateQuantity(l.product.id, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ border: '1px solid var(--pf-border)' }}><Plus size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-4" style={{ borderTop: '1px solid var(--pf-border)' }}>
              <div className="flex justify-between mb-3 font-semibold" style={{ color: 'var(--pf-text)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--pf-primary)' }}>{formatBRL(total)}</span>
              </div>
              <button
                disabled={lines.length === 0}
                onClick={() => { setShowCart(false); setStep('checkout') }}
                className="pf-btn-primary w-full"
              >
                Continuar para o pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
