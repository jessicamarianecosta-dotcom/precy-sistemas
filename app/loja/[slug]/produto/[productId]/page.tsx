'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import { ArrowLeft, Clock, Store, Loader2, CheckCircle } from 'lucide-react'
import { useCart } from '@/lib/catalog/useCart'
import { useToast } from '@/components/ui/Toaster'
import { StoreFooter } from '@/components/catalog/storefront/StoreFooter'
import type { StorefrontSettings } from '@/components/catalog/storefront/types'
import Link from 'next/link'

interface ProductDetail {
  id: string; name: string; description: string | null; final_price: number
  catalog_starting_price: number | null; catalog_promo_price: number | null; catalog_photos: string[]
  catalog_lead_time_days: number | null; catalog_checkout_mode: 'buy' | 'quote' | null
  catalog_category_id: string | null
}

const SETTINGS_COLUMNS = `
  company_id, slug, logo_url, banner_url, description, whatsapp, instagram,
  facebook, tiktok, youtube, pinterest, website, city, state, address,
  business_hours, theme_color, checkout_mode, companies(name)
`

export default function ProdutoLojaPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const { addItem } = useCart(slug)
  const [activePhoto, setActivePhoto] = useState(0)
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteData, setQuoteData] = useState({ name: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const { data: settings } = useQuery<(StorefrontSettings & { checkout_mode: 'buy' | 'quote'; companies: { name: string } | null }) | null>({
    queryKey: ['loja-settings', slug],
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_settings') as any).select(SETTINGS_COLUMNS).eq('slug', slug).maybeSingle()
      return data ?? null
    },
  })

  const { data: product, isLoading } = useQuery<ProductDetail | null>({
    queryKey: ['loja-product', productId],
    queryFn: async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, description, final_price, catalog_starting_price, catalog_promo_price, catalog_photos, catalog_lead_time_days, catalog_checkout_mode, catalog_category_id')
        .eq('id', productId).eq('is_published_catalog', true).maybeSingle()
      return data ?? null
    },
  })

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-text-muted">Carregando…</div>
  if (!product) return <div className="min-h-screen flex items-center justify-center text-text-muted">Produto não encontrado.</div>

  const price = product.catalog_starting_price ?? product.final_price
  const hasPromo = product.catalog_promo_price != null && product.catalog_promo_price < price
  const effectivePrice = hasPromo ? product.catalog_promo_price! : price
  const photos = product.catalog_photos?.length ? product.catalog_photos : []
  const mode = product.catalog_checkout_mode ?? settings?.checkout_mode ?? 'quote'
  const storeName = settings?.companies?.name ?? slug

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch('/api/loja/orcamento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, productId, customer: quoteData }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar solicitação')
      setSent(true)
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link href={`/loja/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary mb-4">
          <ArrowLeft size={15} /> Voltar à loja
        </Link>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="aspect-square rounded-2xl bg-surface dark:bg-white/5 overflow-hidden flex items-center justify-center mb-2">
              {photos[activePhoto] ? <img src={photos[activePhoto]} alt={product.name} className="w-full h-full object-cover" /> : <Store size={40} className="text-text-muted" />}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2">
                {photos.map((p, i) => (
                  <button key={i} onClick={() => setActivePhoto(i)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${activePhoto === i ? 'border-primary' : 'border-transparent'}`}>
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xl font-bold text-text-primary dark:text-stone-100 mb-2">{product.name}</h1>
            {hasPromo ? (
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-2xl font-bold text-error">{formatCurrency(effectivePrice)}</p>
                <p className="text-base text-text-muted line-through">{formatCurrency(price)}</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error text-white">Promoção</span>
              </div>
            ) : (
              <p className="text-2xl font-bold text-primary mb-3">{formatCurrency(price)}</p>
            )}
            {product.catalog_lead_time_days && (
              <p className="flex items-center gap-1.5 text-sm text-text-secondary dark:text-stone-400 mb-3">
                <Clock size={14} /> Prazo estimado: {product.catalog_lead_time_days} dia(s)
              </p>
            )}
            {product.description && <p className="text-sm text-text-secondary dark:text-stone-400 mb-5">{product.description}</p>}

            {mode === 'buy' ? (
              <button
                onClick={() => {
                  addItem({ productId: product.id, name: product.name, price: effectivePrice, quantity: 1, photo: photos[0] ?? null })
                  toast('success', 'Adicionado ao carrinho!')
                  router.push(`/loja/${slug}/checkout`)
                }}
                className="btn-primary w-full"
              >
                Comprar
              </button>
            ) : sent ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-success-light text-success-dark text-sm">
                <CheckCircle size={16} /> Solicitação enviada! Em breve entraremos em contato.
              </div>
            ) : showQuoteForm ? (
              <form onSubmit={submitQuote} className="space-y-2.5">
                <input required className="input" placeholder="Seu nome" value={quoteData.name} onChange={e => setQuoteData({ ...quoteData, name: e.target.value })} />
                <input required className="input" placeholder="Telefone / WhatsApp" value={quoteData.phone} onChange={e => setQuoteData({ ...quoteData, phone: e.target.value })} />
                <textarea className="input" rows={3} placeholder="Detalhes do que você precisa (opcional)" value={quoteData.message} onChange={e => setQuoteData({ ...quoteData, message: e.target.value })} />
                <button type="submit" disabled={sending} className="btn-primary w-full flex items-center justify-center gap-2">
                  {sending && <Loader2 size={15} className="animate-spin" />}
                  Enviar solicitação
                </button>
              </form>
            ) : (
              <button onClick={() => setShowQuoteForm(true)} className="btn-primary w-full">Solicitar orçamento</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
