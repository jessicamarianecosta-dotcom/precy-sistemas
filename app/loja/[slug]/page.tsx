'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Search, Package, Flame, Sparkles } from 'lucide-react'
import { useCart } from '@/lib/catalog/useCart'
import { useProductFavorites } from '@/lib/catalog/useProductFavorites'
import { isNewProduct } from '@/lib/catalog/productFlags'
import { StoreHero } from '@/components/catalog/storefront/StoreHero'
import { StoreHeader } from '@/components/catalog/storefront/StoreHeader'
import { StoreInfoBar } from '@/components/catalog/storefront/StoreInfoBar'
import { ProductCard } from '@/components/catalog/storefront/ProductCard'
import { StoreEmptyState } from '@/components/catalog/storefront/StoreEmptyState'
import { StoreFooter } from '@/components/catalog/storefront/StoreFooter'
import { StoreThemeRoot, StoreThemeToggle } from '@/components/catalog/storefront/StoreThemeRoot'
import { resolvePalettes } from '@/lib/catalog/theme/palette'
import type { StorefrontSettings, StorefrontProduct } from '@/components/catalog/storefront/types'

interface Category { id: string; name: string }
type SortOption = 'relevancia' | 'menor-preco' | 'maior-preco' | 'recentes'
type ViewFilter = '' | 'novidades' | 'mais-vendidos'

const SETTINGS_COLUMNS = `
  company_id, slug, logo_url, banner_url, description, whatsapp, instagram,
  facebook, tiktok, youtube, pinterest, website, city, state, address,
  business_hours, policies_text, theme_color, theme_palette, companies(name)
`

export default function LojaPage() {
  const { slug } = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const router = useRouter()
  const [search, setSearch] = useState(searchParams.get('busca') ?? '')
  const [searchFocused, setSearchFocused] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState<SortOption>('relevancia')
  const viewFilter = (searchParams.get('view') ?? '') as ViewFilter
  const { items } = useCart(slug)
  const { favoriteIds } = useProductFavorites(slug)

  const { data: settings, isLoading: loadingSettings } = useQuery<(StorefrontSettings & { companies: { name: string } | null }) | null>({
    queryKey: ['loja-settings', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.from('catalog_settings') as any)
        .select(SETTINGS_COLUMNS)
        .eq('slug', slug).maybeSingle()
      if (error) throw error
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
        .select('id, name, final_price, catalog_starting_price, catalog_promo_price, catalog_photos, catalog_category_id, created_at, product_images(id, url, sort_order, media_type, is_primary)')
        .eq('company_id', settings!.company_id).eq('is_published_catalog', true)
        .order('sort_order', { foreignTable: 'product_images' })
      // Vídeo nunca aparece como capa da listagem — só fotos.
      return (data ?? []).map((p: any) => ({
        ...p,
        images: (p.product_images ?? [])
          .filter((i: any) => i.media_type !== 'video')
          .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order),
      }))
    },
  })

  /* Mais vendidos — mesma query do dashboard do Catálogo (app/(dashboard)/catalogo/page.tsx) */
  const { data: bestsellerRanking } = useQuery<string[]>({
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
      return [...byProduct.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    },
  })

  const bestsellerIds = useMemo(() => new Set(bestsellerRanking?.slice(0, 8) ?? []), [bestsellerRanking])

  if (loadingSettings) return <div className="min-h-screen flex items-center justify-center text-text-muted">Carregando…</div>
  if (!settings) return <div className="min-h-screen flex items-center justify-center text-text-muted">Loja não encontrada.</div>

  const storeName = settings.companies?.name ?? settings.slug
  const allProducts = products ?? []

  const bestsellerProducts = (bestsellerRanking ?? [])
    .map(id => allProducts.find(p => p.id === id))
    .filter((p): p is StorefrontProduct => !!p)
    .slice(0, 8)

  const newProducts = [...allProducts]
    .filter(p => isNewProduct(p.created_at))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  const favoriteProducts = allProducts.filter(p => favoriteIds.includes(p.id))

  let base = allProducts
  if (viewFilter === 'novidades') base = newProducts
  else if (viewFilter === 'mais-vendidos') base = bestsellerProducts

  let filtered = base.filter(p => {
    if (!p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryId && p.catalog_category_id !== categoryId) return false
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    if (sort === 'menor-preco') return (a.catalog_starting_price ?? a.final_price) - (b.catalog_starting_price ?? b.final_price)
    if (sort === 'maior-preco') return (b.catalog_starting_price ?? b.final_price) - (a.catalog_starting_price ?? a.final_price)
    if (sort === 'recentes') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return 0
  })

  const cartCount = items.reduce((s, i) => s + i.quantity, 0)
  const palettes = resolvePalettes(settings)

  function setView(view: ViewFilter) {
    const params = new URLSearchParams(searchParams.toString())
    if (view) params.set('view', view); else params.delete('view')
    router.push(`/loja/${slug}${params.toString() ? `?${params.toString()}` : ''}#produtos`)
  }

  return (
    <StoreThemeRoot palettes={palettes}>
    <div className="min-h-screen bg-[var(--store-bg)] text-[var(--store-text)] flex flex-col">
      <StoreHeader slug={slug} storeName={storeName} logoUrl={settings.logo_url} cartCount={cartCount} favoriteCount={favoriteProducts.length} />
      <StoreHero settings={settings} storeName={storeName} categories={categories} themeToggle={<StoreThemeToggle />} />

      <div className="max-w-6xl mx-auto px-4 -mt-5 relative z-10 w-full flex-1">
        <StoreInfoBar productCount={allProducts.length} categoryCount={(categories ?? []).length} />

        {/* Categorias — Seção 3.2 */}
        {(categories ?? []).length > 0 && (
          <section id="categorias" className="mt-6 scroll-mt-20">
            <h2 className="text-base font-bold mb-3" style={{ color: 'var(--store-text)' }}>Categorias</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {(categories ?? []).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCategoryId(c.id); document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' }) }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: categoryId === c.id ? 'var(--store-primary)' : 'var(--store-surface)',
                    borderColor: 'var(--store-border)',
                    color: categoryId === c.id ? 'var(--store-button-text)' : 'var(--store-text-secondary)',
                  }}
                >
                  <Package size={20} />
                  <span className="text-[11px] font-medium text-center line-clamp-2">{c.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Mais vendidos — Seção 3.4 (dados reais de vendas) */}
        {!viewFilter && bestsellerProducts.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-1.5" style={{ color: 'var(--store-text)' }}>
                <Flame size={16} /> Mais vendidos
              </h2>
              <button onClick={() => setView('mais-vendidos')} className="text-xs font-semibold" style={{ color: 'var(--store-primary)' }}>Ver todos</button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {bestsellerProducts.map(p => (
                <div key={p.id} className="w-36 flex-shrink-0">
                  <ProductCard slug={slug} product={p} href={`/loja/${slug}/produto/${p.id}`} isBestseller />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Novidades — Seção 3.5 */}
        {!viewFilter && newProducts.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-1.5" style={{ color: 'var(--store-text)' }}>
                <Sparkles size={16} /> Novidades
              </h2>
              <button onClick={() => setView('novidades')} className="text-xs font-semibold" style={{ color: 'var(--store-primary)' }}>Ver todas</button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {newProducts.map(p => (
                <div key={p.id} className="w-36 flex-shrink-0">
                  <ProductCard slug={slug} product={p} href={`/loja/${slug}/produto/${p.id}`} isBestseller={bestsellerIds.has(p.id)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Catálogo completo com busca, filtros e ordenação — Seção 4 */}
        <section id="produtos" className="mt-8 scroll-mt-20 space-y-4 mb-6">
          <h2 className="text-base font-bold" style={{ color: 'var(--store-text)' }}>
            {viewFilter === 'novidades' ? 'Novidades' : viewFilter === 'mais-vendidos' ? 'Mais vendidos' : 'Todos os produtos'}
          </h2>

          <motion.div
            className="relative"
            animate={{ scale: searchFocused ? 1.01 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <Search
              size={16}
              className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchFocused ? '' : 'text-text-muted'}`}
              style={searchFocused ? { color: 'var(--store-primary)' } : undefined}
            />
            <input
              className="input pl-11 h-12 text-sm"
              placeholder="O que você procura hoje?"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </motion.div>

          <div className="flex flex-wrap items-center gap-2">
            {viewFilter && (
              <button
                onClick={() => setView('')}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
                style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
              >
                {viewFilter === 'novidades' ? 'Novidades' : 'Mais vendidos'} ✕
              </button>
            )}
            {(categories ?? []).length > 0 && (
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="input h-9 w-auto text-xs"
              >
                <option value="">Todas as categorias</option>
                {(categories ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <select value={sort} onChange={e => setSort(e.target.value as SortOption)} className="input h-9 w-auto text-xs">
              <option value="relevancia">Relevância</option>
              <option value="menor-preco">Menor preço</option>
              <option value="maior-preco">Maior preço</option>
              <option value="recentes">Mais recentes</option>
            </select>
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
            allProducts.length === 0
              ? <StoreEmptyState whatsapp={settings.whatsapp} />
              : <div className="py-16 text-center text-text-muted text-sm">Nenhum produto encontrado para essa busca.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
              {filtered.map(p => (
                <ProductCard
                  key={p.id}
                  slug={slug}
                  product={p}
                  href={`/loja/${slug}/produto/${p.id}`}
                  isBestseller={bestsellerIds.has(p.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <StoreFooter settings={settings} storeName={storeName} />
    </div>
    </StoreThemeRoot>
  )
}
