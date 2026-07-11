'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import { Search, Instagram, MessageCircle, Store, ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/catalog/useCart'
import Link from 'next/link'

interface Settings {
  company_id: string; slug: string; logo_url: string | null; banner_url: string | null; description: string | null
  whatsapp: string | null; instagram: string | null; theme_color: string
}
interface CatalogProduct {
  id: string; name: string; final_price: number; catalog_starting_price: number | null
  catalog_photos: string[]; catalog_category_id: string | null
}
interface Category { id: string; name: string }

export default function LojaPage() {
  const { slug } = useParams<{ slug: string }>()
  const supabase = createClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const { items } = useCart(slug)

  const { data: settings, isLoading: loadingSettings } = useQuery<Settings | null>({
    queryKey: ['loja-settings', slug],
    queryFn: async () => {
      const { data } = await (supabase.from('catalog_settings') as any)
        .select('company_id, slug, logo_url, banner_url, description, whatsapp, instagram, theme_color')
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

  const { data: products, isLoading: loadingProducts } = useQuery<CatalogProduct[]>({
    queryKey: ['loja-products', settings?.company_id],
    enabled: !!settings,
    queryFn: async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, final_price, catalog_starting_price, catalog_photos, catalog_category_id')
        .eq('company_id', settings!.company_id).eq('is_published_catalog', true)
      return data ?? []
    },
  })

  if (loadingSettings) return <div className="min-h-screen flex items-center justify-center text-text-muted">Carregando…</div>
  if (!settings) return <div className="min-h-screen flex items-center justify-center text-text-muted">Loja não encontrada.</div>

  const filtered = (products ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (!categoryId || p.catalog_category_id === categoryId)
  )
  const cartCount = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      {settings.banner_url && (
        <div className="w-full h-40 sm:h-56 overflow-hidden">
          <img src={settings.banner_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 -mt-8 relative">
        <div className="flex items-end gap-4 mb-4">
          <div className="w-20 h-20 rounded-2xl bg-white dark:bg-surface-dark shadow-card border border-border dark:border-border-dark overflow-hidden flex items-center justify-center flex-shrink-0">
            {settings.logo_url ? <img src={settings.logo_url} alt="" className="w-full h-full object-cover" /> : <Store size={28} className="text-text-muted" />}
          </div>
          <div className="flex-1 pb-1">
            {settings.description && <p className="text-sm text-text-secondary dark:text-stone-400 max-w-lg">{settings.description}</p>}
          </div>
          <button onClick={() => router.push(`/loja/${slug}/checkout`)} className="btn-primary relative">
            <ShoppingBag size={16} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 text-sm text-text-secondary dark:text-stone-400">
          {settings.whatsapp && (
            <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary">
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {settings.instagram && (
            <a href={`https://instagram.com/${settings.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary">
              <Instagram size={14} /> Instagram
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input className="input pl-9" placeholder="Buscar produtos…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <button onClick={() => setCategoryId('')} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${!categoryId ? 'bg-primary text-white' : 'bg-surface dark:bg-white/5 text-text-secondary dark:text-stone-400'}`}>Todos</button>
            {(categories ?? []).map(c => (
              <button key={c.id} onClick={() => setCategoryId(c.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${categoryId === c.id ? 'bg-primary text-white' : 'bg-surface dark:bg-white/5 text-text-secondary dark:text-stone-400'}`}>{c.name}</button>
            ))}
          </div>
        </div>

        {loadingProducts ? (
          <div className="py-10 text-center text-text-muted text-sm">Carregando produtos…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-text-muted text-sm">Nenhum produto encontrado.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
            {filtered.map(p => {
              const price = p.catalog_starting_price ?? p.final_price
              const photo = p.catalog_photos?.[0]
              return (
                <Link key={p.id} href={`/loja/${slug}/produto/${p.id}`} className="card overflow-hidden hover:shadow-card-hover transition-shadow">
                  <div className="aspect-square bg-surface dark:bg-white/5 flex items-center justify-center overflow-hidden">
                    {photo ? <img src={photo} alt={p.name} className="w-full h-full object-cover" /> : <Store size={28} className="text-text-muted" />}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-text-primary dark:text-stone-100 line-clamp-2 mb-1">{p.name}</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(price)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
