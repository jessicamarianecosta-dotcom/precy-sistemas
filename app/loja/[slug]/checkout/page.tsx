'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCart } from '@/lib/catalog/useCart'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import { ArrowLeft, Minus, Plus, Trash2, Loader2, Upload, Search } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface CustomerForm {
  name: string; phone: string; cpfCnpj: string
  cep: string; street: string; number: string; complement: string; district: string; city: string; state: string
  notes: string
}

const EMPTY_CUSTOMER: CustomerForm = {
  name: '', phone: '', cpfCnpj: '',
  cep: '', street: '', number: '', complement: '', district: '', city: '', state: '',
  notes: '',
}

export default function CheckoutLojaPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const { items, updateQty, removeItem, total, clear } = useCart(slug)

  const [customer, setCustomer] = useState<CustomerForm>(EMPTY_CUSTOMER)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [shipping, setShipping] = useState<{ service: string; price: number; days: number } | null>(null)
  const [shippingOptions, setShippingOptions] = useState<{ service: string; price: number; days: number }[]>([])
  const [calculatingShipping, setCalculatingShipping] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function setField(patch: Partial<CustomerForm>) {
    setCustomer(c => ({ ...c, ...patch }))
    // Endereço mudou — a cotação anterior não vale mais para este destino.
    if ('cep' in patch) { setShipping(null); setShippingOptions([]) }
  }

  async function lookupCep() {
    const cep = customer.cep.replace(/\D/g, '')
    if (cep.length !== 8) { toast('error', 'Informe um CEP válido'); return }
    setCepLoading(true)
    try {
      const res = await fetch(`/api/cep/${cep}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'CEP não encontrado')
      setField({
        street: json.data.logradouro ?? customer.street,
        district: json.data.bairro ?? customer.district,
        city: json.data.cidade ?? customer.city,
        state: json.data.uf ?? customer.state,
      })
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setCepLoading(false)
    }
  }

  async function calcShipping() {
    const cep = customer.cep.replace(/\D/g, '')
    if (cep.length !== 8) { toast('error', 'Informe um CEP válido'); return }
    setCalculatingShipping(true)
    try {
      const res = await fetch('/api/loja/frete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, cep,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
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
    if (!customer.cep || !customer.street || !customer.number || !customer.district || !customer.city || !customer.state) {
      toast('error', 'Preencha o endereço de entrega completo'); return
    }
    if (!shipping) { toast('error', 'Calcule e escolha uma opção de frete'); return }

    setSubmitting(true)
    try {
      let artwork: { url: string; path: string; fileName: string; fileSize: number; mimeType: string | null } | null = null
      if (artworkFile) {
        const body = new FormData()
        body.append('file', artworkFile)
        body.append('slug', slug)
        const res = await fetch('/api/loja/upload-arte', { method: 'POST', body })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar arte')
        artwork = { url: data.url, path: data.path, fileName: data.fileName, fileSize: data.fileSize, mimeType: data.mimeType }
      }

      const res = await fetch('/api/loja/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          items: items.map(i => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
          customer,
          // Preço nunca é enviado — só qual serviço foi escolhido. O backend
          // recota e usa sempre o próprio valor (ver /api/loja/checkout).
          shippingService: shipping.service,
          artwork,
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
                <div key={`${item.productId}:${item.variantId ?? ''}`} className="flex items-center gap-3 p-3">
                  <div className="relative w-12 h-12 rounded-lg bg-surface dark:bg-white/5 overflow-hidden flex-shrink-0">
                    {item.photo && <Image src={item.photo} alt="" fill sizes="48px" className="object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                    {item.variantLabel && <p className="text-[11px] text-text-muted truncate">{item.variantLabel}</p>}
                    <p className="text-xs text-text-muted">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateQty(item.productId, item.variantId, item.quantity - 1)} className="p-1 rounded hover:bg-primary-50 dark:hover:bg-white/5"><Minus size={13} /></button>
                    <span className="text-sm w-5 text-center">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.productId, item.variantId, item.quantity + 1)} className="p-1 rounded hover:bg-primary-50 dark:hover:bg-white/5"><Plus size={13} /></button>
                  </div>
                  <button type="button" onClick={() => removeItem(item.productId, item.variantId)} className="p-1.5 text-text-muted hover:text-error"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Seus dados</h3>
                <input required className="input" placeholder="Nome completo" value={customer.name} onChange={e => setField({ name: e.target.value })} />
                <input required className="input" placeholder="Telefone / WhatsApp" value={customer.phone} onChange={e => setField({ phone: e.target.value })} />
                <input className="input" placeholder="CPF/CNPJ" value={customer.cpfCnpj} onChange={e => setField({ cpfCnpj: e.target.value })} />
              </div>

              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Endereço de entrega</h3>
                <div className="flex gap-2">
                  <input required className="input flex-1" placeholder="CEP" value={customer.cep} onChange={e => setField({ cep: e.target.value })} />
                  <button type="button" onClick={lookupCep} disabled={cepLoading} className="btn-secondary whitespace-nowrap flex items-center gap-1.5">
                    {cepLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input required className="input col-span-2" placeholder="Rua" value={customer.street} onChange={e => setField({ street: e.target.value })} />
                  <input required className="input" placeholder="Número" value={customer.number} onChange={e => setField({ number: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Complemento (opcional)" value={customer.complement} onChange={e => setField({ complement: e.target.value })} />
                  <input required className="input" placeholder="Bairro" value={customer.district} onChange={e => setField({ district: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input required className="input col-span-2" placeholder="Cidade" value={customer.city} onChange={e => setField({ city: e.target.value })} />
                  <input required className="input" placeholder="UF" maxLength={2} value={customer.state} onChange={e => setField({ state: e.target.value.toUpperCase() })} />
                </div>

                <button type="button" onClick={calcShipping} disabled={calculatingShipping} className="btn-secondary w-full flex items-center justify-center gap-1.5">
                  {calculatingShipping ? <Loader2 size={15} className="animate-spin" /> : 'Calcular frete'}
                </button>

                {shippingOptions.length > 0 && (
                  <div className="space-y-1.5">
                    {shippingOptions.map(opt => (
                      <label key={opt.service} className="flex items-center justify-between text-sm p-2.5 rounded-lg border border-border dark:border-border-dark cursor-pointer">
                        <span className="flex items-center gap-2">
                          <input type="radio" name="shipping" checked={shipping?.service === opt.service} onChange={() => setShipping(opt)} />
                          {opt.service} · {opt.days} dia(s)
                        </span>
                        <span className="font-semibold">{formatCurrency(opt.price)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="card p-4 space-y-3">
                <textarea className="input" rows={2} placeholder="Observações (opcional)" value={customer.notes} onChange={e => setField({ notes: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-stone-400 cursor-pointer">
                  <Upload size={15} />
                  {artworkFile ? artworkFile.name : 'Enviar arte (opcional)'}
                  <input type="file" className="hidden" onChange={e => setArtworkFile(e.target.files?.[0] ?? null)} />
                </label>
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

              <button type="submit" disabled={submitting || !shipping} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
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
