'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCart } from '@/lib/catalog/useCart'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import { ArrowLeft, Minus, Plus, Trash2, Loader2, Upload } from 'lucide-react'
import Link from 'next/link'

export default function CheckoutLojaPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const { items, updateQty, removeItem, total, clear } = useCart(slug)

  const [customer, setCustomer] = useState({ name: '', phone: '', cpfCnpj: '', address: '', cep: '', notes: '' })
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [shipping, setShipping] = useState<{ service: string; price: number; days: number } | null>(null)
  const [shippingOptions, setShippingOptions] = useState<{ service: string; price: number; days: number }[]>([])
  const [calculatingShipping, setCalculatingShipping] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function calcShipping() {
    const cep = customer.cep.replace(/\D/g, '')
    if (cep.length !== 8) { toast('error', 'Informe um CEP válido'); return }
    setCalculatingShipping(true)
    try {
      const res = await fetch('/api/loja/frete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, cep,
          items: items.map(() => ({ weightKg: 0.3, lengthCm: 20, heightCm: 5, widthCm: 15, quantity: 1 })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao calcular frete')
      setShippingOptions(data.quotes ?? [])
      setShipping(data.quotes?.[0] ?? null)
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setCalculatingShipping(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { toast('error', 'Seu carrinho está vazio'); return }
    if (!customer.name || !customer.phone) { toast('error', 'Nome e telefone são obrigatórios'); return }

    setSubmitting(true)
    try {
      let artworkUrl: string | null = null
      if (artworkFile) {
        const body = new FormData()
        body.append('file', artworkFile)
        body.append('slug', slug)
        const res = await fetch('/api/loja/upload-arte', { method: 'POST', body })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar arte')
        artworkUrl = data.url
      }

      const res = await fetch('/api/loja/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          customer,
          shippingPrice: shipping?.price ?? 0,
          artworkUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao finalizar pedido')

      clear()
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        toast('success', `Pedido ${data.orderNumber} criado!`)
        router.push(`/loja/${slug}`)
      }
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href={`/loja/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary mb-4">
          <ArrowLeft size={15} /> Continuar comprando
        </Link>

        <h1 className="text-lg font-bold text-text-primary dark:text-stone-100 mb-4">Finalizar pedido</h1>

        {items.length === 0 ? (
          <p className="text-sm text-text-muted">Seu carrinho está vazio.</p>
        ) : (
          <div className="space-y-5">
            <div className="card divide-y divide-border dark:divide-border-dark">
              {items.map(item => (
                <div key={item.productId} className="flex items-center gap-3 p-3">
                  <div className="w-12 h-12 rounded-lg bg-surface dark:bg-white/5 overflow-hidden flex-shrink-0">
                    {item.photo && <img src={item.photo} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                    <p className="text-xs text-text-muted">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateQty(item.productId, item.quantity - 1)} className="p-1 rounded hover:bg-primary-50 dark:hover:bg-white/5"><Minus size={13} /></button>
                    <span className="text-sm w-5 text-center">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.productId, item.quantity + 1)} className="p-1 rounded hover:bg-primary-50 dark:hover:bg-white/5"><Plus size={13} /></button>
                  </div>
                  <button type="button" onClick={() => removeItem(item.productId)} className="p-1.5 text-text-muted hover:text-error"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Seus dados</h3>
                <input required className="input" placeholder="Nome completo" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
                <input required className="input" placeholder="Telefone / WhatsApp" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                <input className="input" placeholder="CPF/CNPJ" value={customer.cpfCnpj} onChange={e => setCustomer({ ...customer, cpfCnpj: e.target.value })} />
                <input className="input" placeholder="Endereço completo" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="CEP" value={customer.cep} onChange={e => setCustomer({ ...customer, cep: e.target.value })} />
                  <button type="button" onClick={calcShipping} disabled={calculatingShipping} className="btn-secondary whitespace-nowrap">
                    {calculatingShipping ? <Loader2 size={15} className="animate-spin" /> : 'Calcular frete'}
                  </button>
                </div>
                {shippingOptions.length > 0 && (
                  <div className="space-y-1.5">
                    {shippingOptions.map(opt => (
                      <label key={opt.service} className="flex items-center justify-between text-sm p-2 rounded-lg border border-border dark:border-border-dark cursor-pointer">
                        <span className="flex items-center gap-2">
                          <input type="radio" name="shipping" checked={shipping?.service === opt.service} onChange={() => setShipping(opt)} />
                          {opt.service} · {opt.days} dia(s)
                        </span>
                        <span className="font-semibold">{formatCurrency(opt.price)}</span>
                      </label>
                    ))}
                  </div>
                )}
                <textarea className="input" rows={2} placeholder="Observações (opcional)" value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} />
                <div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-stone-400 cursor-pointer">
                    <Upload size={15} />
                    {artworkFile ? artworkFile.name : 'Enviar arte (opcional)'}
                    <input type="file" className="hidden" onChange={e => setArtworkFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>

              <div className="card p-4 space-y-1.5">
                <div className="flex justify-between text-sm text-text-secondary dark:text-stone-400">
                  <span>Subtotal</span><span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary dark:text-stone-400">
                  <span>Frete</span><span>{formatCurrency(shipping?.price ?? 0)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-text-primary dark:text-stone-100 pt-1.5 border-t border-border dark:border-border-dark">
                  <span>Total</span><span>{formatCurrency(total + (shipping?.price ?? 0))}</span>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
                {submitting && <Loader2 size={15} className="animate-spin" />}
                Ir para pagamento
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
