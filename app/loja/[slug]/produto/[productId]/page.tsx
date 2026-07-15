'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import { ArrowLeft, Clock, Store, Loader2, CheckCircle, X, ZoomIn } from 'lucide-react'
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
interface ProductImageRow { id: string; url: string; sort_order: number }
interface OptionRow { id: string; group_id: string; value: string; sort_order: number }
interface GroupRow { id: string; name: string; sort_order: number; options: OptionRow[] }
interface VariantRow {
  id: string
  sku: string | null
  price: number | null
  stock_quantity: number | null
  lead_time_days: number | null
  image_id: string | null
  optionIds: string[]
}

const SETTINGS_COLUMNS = `
  company_id, slug, logo_url, banner_url, description, whatsapp, instagram,
  facebook, tiktok, youtube, pinterest, website, city, state, address,
  business_hours, theme_color, checkout_mode, companies(name)
`

function comboKey(optionIds: (string | undefined)[]) { return optionIds.join('|') }

export default function ProdutoLojaPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const { addItem } = useCart(slug)
  const [activePhoto, setActivePhoto] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteData, setQuoteData] = useState({ name: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const touchStartX = useRef<number | null>(null)

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

  const { data: imageRows } = useQuery<ProductImageRow[]>({
    queryKey: ['loja-product-images', productId],
    queryFn: async () => {
      const { data } = await (supabase.from('product_images') as any)
        .select('id, url, sort_order').eq('product_id', productId).order('sort_order')
      return data ?? []
    },
  })

  const { data: groupRows } = useQuery<GroupRow[]>({
    queryKey: ['loja-product-groups', productId],
    queryFn: async () => {
      const { data } = await (supabase.from('product_variation_groups') as any)
        .select('id, name, sort_order, product_variation_options(id, group_id, value, sort_order)')
        .eq('product_id', productId)
        .order('sort_order')
        .order('sort_order', { foreignTable: 'product_variation_options' })
      return (data ?? []).map((g: any) => ({ id: g.id, name: g.name, sort_order: g.sort_order, options: g.product_variation_options ?? [] }))
    },
  })

  const { data: variantRows } = useQuery<VariantRow[]>({
    queryKey: ['loja-product-variants', productId],
    queryFn: async () => {
      const { data } = await (supabase.from('product_variants') as any)
        .select('id, sku, price, stock_quantity, lead_time_days, image_id, sort_order, product_variant_option_values(option_id, group_id)')
        .eq('product_id', productId).eq('is_active', true).order('sort_order')
      return (data ?? []).map((v: any) => ({
        id: v.id, sku: v.sku, price: v.price, stock_quantity: v.stock_quantity,
        lead_time_days: v.lead_time_days, image_id: v.image_id,
        optionIds: (v.product_variant_option_values ?? []).map((ov: any) => ({ group_id: ov.group_id, option_id: ov.option_id })),
      }))
    },
  })

  // Regras de dependência (ex: "Triplex/Offset" só existe em 300g) — usadas
  // pra desabilitar, em vez de deixar clicar e falhar, as opções que
  // levariam a uma combinação que não existe de verdade.
  const { data: depRows } = useQuery<{ option_id: string; depends_on_option_id: string }[]>({
    queryKey: ['loja-product-variation-deps', productId],
    queryFn: async () => {
      const { data } = await (supabase.from('product_variation_dependencies') as any)
        .select('option_id, depends_on_option_id').eq('product_id', productId)
      return data ?? []
    },
  })

  const groups = useMemo(() => groupRows ?? [], [groupRows])
  const images = imageRows ?? []

  const parentsByOption = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const d of depRows ?? []) {
      if (!map.has(d.option_id)) map.set(d.option_id, new Set())
      map.get(d.option_id)!.add(d.depends_on_option_id)
    }
    return map
  }, [depRows])

  // Normaliza optionIds na ordem dos grupos (necessário porque a query retorna pares group_id/option_id soltos)
  const variantsNormalized = useMemo<VariantRow[]>(() => {
    return (variantRows ?? []).map((v: any) => {
      const byGroup = new Map<string, string>((v.optionIds ?? []).map((ov: any) => [ov.group_id, ov.option_id]))
      return { ...v, optionIds: groups.map(g => byGroup.get(g.id)).filter((x): x is string => !!x) }
    })
  }, [variantRows, groups])

  function isAllowedGiven(optionId: string, selection: Record<string, string>): boolean {
    const parents = parentsByOption.get(optionId)
    if (!parents || parents.size === 0) return true
    const chosen = Object.values(selection)
    return [...parents].some(p => chosen.includes(p))
  }

  function isOptionAllowed(optionId: string): boolean {
    return isAllowedGiven(optionId, selectedOptions)
  }

  /**
   * Recalcula a seleção grupo a grupo (na ordem de sort_order): mantém a
   * escolha de `base` para um grupo só se ela ainda for válida dado o que já
   * foi processado; senão troca pela primeira opção permitida. Usado tanto
   * na seleção automática inicial quanto ao clicar numa opção — nesse caso,
   * se ela invalidar a opção já escolhida de um grupo seguinte (ex: trocar
   * o Papel para "Triplex/Offset" quando a Gramatura escolhida era 180g),
   * o grupo seguinte é reajustado automaticamente em vez de ficar num estado
   * de combinação inexistente.
   */
  function computeSelection(base: Record<string, string>): Record<string, string> {
    const next: Record<string, string> = {}
    for (const g of groups) {
      const current = g.options.find(o => o.id === base[g.id])
      if (current && isAllowedGiven(current.id, next)) {
        next[g.id] = current.id
      } else {
        const firstAllowed = g.options.find(o => isAllowedGiven(o.id, next))
        if (firstAllowed) next[g.id] = firstAllowed.id
      }
    }
    return next
  }

  // Seleciona a primeira opção válida de cada grupo automaticamente
  // (comportamento padrão de e-commerce) e corrige qualquer seleção que as
  // regras de dependência tenham invalidado.
  useEffect(() => {
    if (groups.length === 0) return
    setSelectedOptions(prev => {
      const next = computeSelection(prev)
      const same = groups.every(g => next[g.id] === prev[g.id]) && Object.keys(prev).length === Object.keys(next).length
      return same ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, parentsByOption])

  const selectedVariant = useMemo(() => {
    if (groups.length === 0) return null
    if (groups.some(g => !selectedOptions[g.id])) return null
    const key = comboKey(groups.map(g => selectedOptions[g.id]))
    return variantsNormalized.find(v => comboKey(v.optionIds) === key) ?? null
  }, [groups, selectedOptions, variantsNormalized])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLightboxOpen(false) }
    if (lightboxOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightboxOpen])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-text-muted">Carregando…</div>
  if (!product) return <div className="min-h-screen flex items-center justify-center text-text-muted">Produto não encontrado.</div>

  const price = product.catalog_starting_price ?? product.final_price
  const hasPromo = product.catalog_promo_price != null && product.catalog_promo_price < price
  const baseEffectivePrice = hasPromo ? product.catalog_promo_price! : price
  const effectivePrice = selectedVariant?.price ?? baseEffectivePrice
  const variantHasPromo = selectedVariant?.price == null && hasPromo

  const photos = images.length ? images.map(i => i.url) : (product.catalog_photos?.length ? product.catalog_photos : [])
  const variantImage = selectedVariant?.image_id ? images.find(i => i.id === selectedVariant.image_id)?.url : null
  const displayPhotos = variantImage ? [variantImage, ...photos.filter(p => p !== variantImage)] : photos

  const effectiveStock = selectedVariant?.stock_quantity ?? null
  const isSoldOut = effectiveStock != null && effectiveStock <= 0
  const needsSelection = groups.length > 0 && !selectedVariant
  const effectiveLeadTime = selectedVariant?.lead_time_days ?? product.catalog_lead_time_days

  const mode = product.catalog_checkout_mode ?? settings?.checkout_mode ?? 'quote'
  const storeName = settings?.companies?.name ?? slug

  const variantLabel = groups.length > 0 && selectedVariant
    ? groups.map(g => `${g.name}: ${g.options.find(o => o.id === selectedOptions[g.id])?.value ?? ''}`).join(' · ')
    : null

  function goToPhoto(delta: number) {
    setActivePhoto(prev => {
      const len = displayPhotos.length
      if (len === 0) return prev
      return (prev + delta + len) % len
    })
  }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 40) goToPhoto(delta < 0 ? 1 : -1)
    touchStartX.current = null
  }

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch('/api/loja/orcamento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, productId, variantId: selectedVariant?.id ?? null, variantLabel, customer: quoteData }),
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
            {/* Desktop/tablet: imagem grande + miniaturas ao lado */}
            <div className="hidden sm:block">
              <button
                type="button"
                onClick={() => displayPhotos[activePhoto] && setLightboxOpen(true)}
                className="relative w-full aspect-square rounded-2xl bg-surface dark:bg-white/5 overflow-hidden flex items-center justify-center mb-2 group"
              >
                {displayPhotos[activePhoto] ? (
                  <>
                    <motion.img
                      key={displayPhotos[activePhoto]}
                      src={displayPhotos[activePhoto]}
                      alt={product.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn size={14} />
                    </span>
                  </>
                ) : <Store size={40} className="text-text-muted" />}
              </button>
              {displayPhotos.length > 1 && (
                <div className="flex gap-2">
                  {displayPhotos.map((p, i) => (
                    <button key={p + i} onClick={() => setActivePhoto(i)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${activePhoto === i ? 'border-primary' : 'border-transparent'}`}>
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile: slider com swipe + dots */}
            <div className="sm:hidden">
              <div
                className="relative w-full aspect-square rounded-2xl bg-surface dark:bg-white/5 overflow-hidden flex items-center justify-center mb-2"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onClick={() => displayPhotos[activePhoto] && setLightboxOpen(true)}
              >
                {displayPhotos[activePhoto] ? (
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={displayPhotos[activePhoto]}
                      src={displayPhotos[activePhoto]}
                      alt={product.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full object-cover"
                    />
                  </AnimatePresence>
                ) : <Store size={40} className="text-text-muted" />}
              </div>
              {displayPhotos.length > 1 && (
                <div className="flex items-center justify-center gap-1.5">
                  {displayPhotos.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${activePhoto === i ? 'bg-primary' : 'bg-border dark:bg-border-dark'}`} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold text-text-primary dark:text-stone-100 mb-2">{product.name}</h1>
            {variantHasPromo ? (
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-2xl font-bold text-error">{formatCurrency(effectivePrice)}</p>
                <p className="text-base text-text-muted line-through">{formatCurrency(price)}</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error text-white">Promoção</span>
              </div>
            ) : (
              <p className="text-2xl font-bold text-primary mb-3">{formatCurrency(effectivePrice)}</p>
            )}

            {effectiveLeadTime && (
              <p className="flex items-center gap-1.5 text-sm text-text-secondary dark:text-stone-400 mb-3">
                <Clock size={14} /> Prazo estimado: {effectiveLeadTime} dia(s)
              </p>
            )}
            {product.description && <p className="text-sm text-text-secondary dark:text-stone-400 mb-5">{product.description}</p>}

            {groups.length > 0 && (
              <div className="space-y-3 mb-5">
                {groups.map(g => (
                  <div key={g.id}>
                    <p className="text-xs font-semibold text-text-primary dark:text-stone-100 mb-1.5">{g.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.options.map(opt => {
                        const active = selectedOptions[g.id] === opt.id
                        const allowed = isOptionAllowed(opt.id)
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={!allowed}
                            title={!allowed ? 'Combinação indisponível' : undefined}
                            onClick={() => setSelectedOptions(prev => computeSelection({ ...prev, [g.id]: opt.id }))}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              !allowed
                                ? 'bg-surface dark:bg-white/5 text-text-muted/40 dark:text-stone-600 border-border dark:border-border-dark cursor-not-allowed opacity-50'
                                : active
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface dark:bg-white/5 text-text-secondary dark:text-stone-400 border-border dark:border-border-dark hover:border-primary/50'
                            }`}
                          >
                            {opt.value}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {selectedVariant?.sku && (
                  <p className="text-[11px] text-text-muted">SKU: {selectedVariant.sku}</p>
                )}
                {effectiveStock != null && !isSoldOut && (
                  <p className="text-[11px] text-text-muted">{effectiveStock} em estoque</p>
                )}
              </div>
            )}

            {mode === 'buy' ? (
              <button
                disabled={needsSelection || isSoldOut}
                onClick={() => {
                  addItem({
                    productId: product.id,
                    variantId: selectedVariant?.id ?? null,
                    variantLabel,
                    variantSku: selectedVariant?.sku ?? null,
                    name: product.name,
                    price: effectivePrice,
                    quantity: 1,
                    photo: displayPhotos[0] ?? null,
                  })
                  toast('success', 'Adicionado ao carrinho!')
                  router.push(`/loja/${slug}/checkout`)
                }}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSoldOut ? 'Esgotado' : needsSelection ? 'Selecione as opções' : 'Comprar'}
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
              <button disabled={needsSelection} onClick={() => setShowQuoteForm(true)} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                {needsSelection ? 'Selecione as opções' : 'Solicitar orçamento'}
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {lightboxOpen && displayPhotos[activePhoto] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
              <X size={18} />
            </button>
            <motion.img
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2 }}
              src={displayPhotos[activePhoto]}
              alt={product.name}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {settings && <StoreFooter settings={settings as any} storeName={storeName} />}
    </div>
  )
}
