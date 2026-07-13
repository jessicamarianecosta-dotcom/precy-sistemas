'use client'

import { Store, MessageCircle, Instagram, Share2, Link2, Heart, MapPin } from 'lucide-react'
import { clsx } from 'clsx'
import { useToast } from '@/components/ui/Toaster'
import { useFavorites } from '@/lib/catalog/useFavorites'
import type { StorefrontSettings } from './types'

interface Props {
  settings:  StorefrontSettings
  storeName: string
}

export function StoreHero({ settings, storeName }: Props) {
  const { toast } = useToast()
  const { isFavorite, toggle } = useFavorites()
  const favorited = isFavorite(settings.slug)

  const storeUrl = typeof window !== 'undefined' ? window.location.href : ''

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: storeName, url: storeUrl })
        return
      } catch { /* usuário cancelou */ }
    }
    navigator.clipboard.writeText(storeUrl).then(() => toast('success', 'Link copiado!'))
  }

  return (
    <div className="relative w-full h-56 sm:h-72 lg:h-80 overflow-hidden">
      {settings.banner_url ? (
        <img src={settings.banner_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${settings.theme_color}, ${settings.theme_color}66)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

      <div className="absolute inset-x-0 bottom-0">
        <div className="max-w-6xl mx-auto px-4 pb-4 sm:pb-6">
          <div className="flex items-end gap-4 mb-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-lg overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white">
              {settings.logo_url ? <img src={settings.logo_url} alt={storeName} className="w-full h-full object-cover" /> : <Store size={28} className="text-text-muted" />}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-white font-bold text-lg sm:text-2xl truncate drop-shadow-sm">{storeName}</h1>
              {settings.city && (
                <p className="text-white/85 text-xs sm:text-sm flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {settings.city}{settings.state ? ` · ${settings.state}` : ''}
                </p>
              )}
            </div>
          </div>

          {settings.description && (
            <p className="text-white/90 text-sm max-w-2xl mb-3 line-clamp-2">{settings.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {settings.whatsapp && (
              <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/95 text-text-primary hover:bg-white transition-colors">
                <MessageCircle size={13} /> WhatsApp
              </a>
            )}
            {settings.instagram && (
              <a href={`https://instagram.com/${settings.instagram.replace('@', '')}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/95 text-text-primary hover:bg-white transition-colors">
                <Instagram size={13} /> Instagram
              </a>
            )}
            <button onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/20 text-white hover:bg-white/30 transition-colors backdrop-blur-sm">
              <Share2 size={13} /> Compartilhar
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(storeUrl); toast('success', 'Link copiado!') }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/20 text-white hover:bg-white/30 transition-colors backdrop-blur-sm">
              <Link2 size={13} /> Copiar link
            </button>
            <button
              onClick={() => toggle(settings.slug)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm',
                favorited ? 'bg-error text-white' : 'bg-white/20 text-white hover:bg-white/30'
              )}>
              <Heart size={13} className={favorited ? 'fill-current' : ''} /> {favorited ? 'Favoritado' : 'Favoritar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
