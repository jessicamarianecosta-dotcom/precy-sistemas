'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/catalog/useCart'
import { useProductFavorites } from '@/lib/catalog/useProductFavorites'
import { resolvePalettes, type StoreThemePalettes } from '@/lib/catalog/theme/palette'
import { StoreThemeRoot } from '@/components/catalog/storefront/StoreThemeRoot'
import { StoreHeader } from '@/components/catalog/storefront/StoreHeader'
import { ProductCard } from '@/components/catalog/storefront/ProductCard'
import type { StorefrontProduct } from '@/components/catalog/storefront/types'

const SETTINGS_COLUMNS = `company_id, logo_url, theme_color, theme_palette, companies(name)`

export default function FavoritosLojaPage() {
  const { slug } = useParams<{ slug: string }>()
  const supabase = createClient()
  const { items } = useCart(slug)
  const { favoriteIds } = useProductFavorites(slug)

  const { data: settings, isLoading: loadingSettings } = useQuery<{ company_id: string; logo_url: string | null; theme_color: string; theme_palette: StoreThemePalettes | null; companies: { name: string } | null } | null>({
    queryKey: ['loja-favoritos-settings', slug],
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_settings') as any).select(SETTINGS_COLUMNS).eq('slug', slug).maybeSingle()
      return data ?? null
    },
  })

  const { data: products, isLoading: loadingProducts } = useQuery<StorefrontProduct[]>({
    queryKey: ['loja-favoritos-products', settings?.company_id, favoriteIds],
    enabled: !!settings && favoriteIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, final_price, catalog_starting_price, catalog_promo_price, catalog_photos, catalog_category_id, created_at, product_images(id, url, sort_order, media_type, is_primary)')
        .eq('company_id', settings!.company_id)
        .eq('is_published_catalog', true)
        .in('id', favoriteIds)
      return (data ?? []).map((p: any) => ({
        ...p,
        images: (p.product_images ?? [])
          .filter((i: any) => i.media_type !== 'video')
          .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order),
      }))
    },
  })

  const storeName = settings?.companies?.name ?? slug
  const palettes = resolvePalettes(settings ?? { theme_color: '#8B6C4F', theme_palette: null })
  const cartCount = items.reduce((s, i) => s + i.quantity, 0)

  if (loadingSettings) return <div className="min-h-screen flex items-center justify-center text-text-muted">Carregando…</div>

  return (
    <StoreThemeRoot palettes={palettes}>
    <div className="min-h-screen bg-[var(--store-bg)] text-[var(--store-text)]">
      <StoreHeader slug={slug} storeName={storeName} logoUrl={settings?.logo_url} cartCount={cartCount} favoriteCount={favoriteIds.length} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Link href={`/loja/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-[var(--store-primary)] mb-4">
          <ArrowLeft size={15} /> Continuar comprando
        </Link>

        <h1 className="text-lg font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--store-text)' }}>
          <Heart size={18} /> Meus favoritos
        </h1>

        {favoriteIds.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center">
            <Heart size={32} className="text-text-muted mb-3" />
            <p className="text-sm text-text-muted max-w-sm">
              Você ainda não favoritou nenhum produto. Toque no coração nos produtos para salvá-los aqui.
            </p>
          </div>
        ) : loadingProducts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="aspect-square bg-surface dark:bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-surface dark:bg-white/5 rounded" />
                  <div className="h-3 w-1/2 bg-surface dark:bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (products ?? []).length === 0 ? (
          <p className="text-sm text-text-muted py-10 text-center">Os produtos favoritados não estão mais disponíveis nesta loja.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
            {(products ?? []).map(p => (
              <ProductCard key={p.id} slug={slug} product={p} href={`/loja/${slug}/produto/${p.id}`} isBestseller={false} />
            ))}
          </div>
        )}
      </div>
    </div>
    </StoreThemeRoot>
  )
}
