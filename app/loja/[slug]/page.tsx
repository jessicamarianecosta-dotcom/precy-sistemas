'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Search, ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/catalog/useCart'
import { StoreHero } from '@/components/catalog/storefront/StoreHero'
import { StoreInfoBar } from '@/components/catalog/storefront/StoreInfoBar'
import { ProductCard } from '@/components/catalog/storefront/ProductCard'
import { StoreEmptyState } from '@/components/catalog/storefront/StoreEmptyState'
import { StoreFooter } from '@/components/catalog/storefront/StoreFooter'
import type { StorefrontSettings, StorefrontProduct } from '@/components/catalog/storefront/types'

interface Category { id: string; name: string }

const SETTINGS_COLUMNS = `
  company_id, slug, logo_url, banner_url, description, whatsapp, instagram,
  facebook, tiktok, youtube, pinterest, website, city, state, address,
  business_hours, theme_color, companies(name)
`

export default function LojaPage() {
  const { slug } = useParams<{ slug: string }>()
  const supabase = createClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const { items } = useCart(slug)

  const { data: settings, isLoading: loadingSettings } = useQuery<(StorefrontSettings & { companies: { name: string } | null }) | null>({
    queryKey: ['loja-settings', slug],
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_settings') as any)
        .select(SETTINGS_COLUMNS)
        .eq('slug', slug).maybeSingle()
      return data ?? null
    },
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['loja-categories', settings?.company_id],
    enabled: !!settings,
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_categories') as any).select('id, name').eq('company_id', settings!.company_id).order('sort_order')
      return data ?? []
    },
  })

  const { data: products, isLoading: loadingProducts } = useQuery<StorefrontProduct[]>({
    queryKey: ['loja-products', settings?.company_id],
    enabled: !!settings,
    queryFn: async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, final_price, catalog_starting_price, catalog_promo_price, catalog_photos, catalog_category_id, created_at')
        .eq('company_id', settings!.company_id).eq('is_published_catalog', true)
      return data ?? []
    },
  })

  /* Top 3 mais vendidos — mesma query do dashboard do Catálogo (app/(dashboard)/catalogo/page.tsx) */
  const { data: bestsellerIds } = useQuery<Set<string>>({
    queryKey: ['loja-bestsellers', settings?.company_id],
    enabled: !!settings,
    queryFn: async () => {
      const { data } = await (supabase.from('order_items') as any)
        .select('product_id, quantity, orders!inner(company_id, source, payment_status)')
        .eq('orders.company_id', settings!.company_id)
        .eq('orders.source', 'catalog')
        .eq('orders.payment_status', 'paid')

      const byProduct = new Map<string, number>()
      for (const it of data ?? []) {
        if (!it.product_id) continue
        byProduct.set(it.product_id, (byProduct.get(it.product_id) ?? 0) + Number(it.quantity))
      }
      const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)
      return new Set(top)
    },
  })

  if (loadingSettings) return <div className="min-h-screen flex items-center justify-center text-text-muted">Carregando…</div>
  if (!settings) return <div className="min-h-screen flex items-center justify-center text-text-muted">Loja não encontrada.</div>

  const storeName = settings.companies?.name ?? settings.slug

  const filtered = (products ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (!categoryId || p.catalog_category_id === categoryId)
  )
  const cartCount = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark flex flex-col">
      <StoreHero settings={settings} storeName={storeName} />

      <div className="max-w-6xl mx-auto px-4 -mt-5 relative z-10 w-full flex-1">
        <div className="flex items-start gap-3 mb-5">
          <div className="flex-1">
            <StoreInfoBar settings={settings} productCount={(products ?? []).length} categoryCount={(categories ?? []).length} />
          </div>
          <button onClick={() => router.push(`/loja/${slug}/checkout`)} className="btn-primary relative h-[52px] flex-shrink-0">
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <motion.div
            className="relative"
            animate={{ scale: searchFocused ? 1.01 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchFocused ? 'text-primary' : 'text-text-muted'}`} />
            <input
              className="input pl-11 h-12 text-sm"
              placeholder="O que você procura hoje?"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </motion.div>

          {(categories ?? []).length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setCategoryId('')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${!categoryId ? 'bg-primary text-white' : 'bg-surface dark:bg-white/5 text-text-secondary dark:text-stone-400 hover:bg-primary-50'}`}
              >
                Todos
              </button>
              {(categories ?? []).map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${categoryId === c.id ? 'bg-primary text-white' : 'bg-surface dark:bg-white/5 text-text-secondary dark:text-stone-400 hover:bg-primary-50'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loadingProducts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="aspect-square bg-surface dark:bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-surface dark:bg-white/5 rounded" />
                  <div className="h-3 w-1/2 bg-surface dark:bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          (products ?? []).length === 0
            ? <StoreEmptyState whatsapp={settings.whatsapp} />
            : <div className="py-16 text-center text-text-muted text-sm">Nenhum produto encontrado para essa busca.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                href={`/loja/${slug}/produto/${p.id}`}
                isBestseller={bestsellerIds?.has(p.id) ?? false}
              />
            ))}
          </div>
        )}
      </div>

      <StoreFooter settings={settings} storeName={storeName} />
    </div>
  )
}
