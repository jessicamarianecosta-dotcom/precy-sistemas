'use client'

import { useMemo } from 'react'
import { Store, MessageCircle, Instagram, Share2, Link2, Heart, MapPin } from 'lucide-react'
import { clsx } from 'clsx'
import { useToast } from '@/components/ui/Toaster'
import { useFavorites } from '@/lib/catalog/useFavorites'
import { useImageBrightness } from '@/lib/catalog/useImageBrightness'
import type { StorefrontSettings } from './types'

interface Props {
  settings:  StorefrontSettings
  storeName: string
}

// Overlay de referência (banner claro, pior caso): topo 15%, meio 55%, base 75%.
// Para banners médios/escuros a mesma curva é escalada proporcionalmente para
// a base ficar em 60%/45% — nunca deixando o texto sem contraste suficiente.
const OVERLAY_BOTTOM_BY_LEVEL = { dark: 0.45, medium: 0.6, light: 0.75 } as const

function overlayGradient(level: 'dark' | 'medium' | 'light') {
  const bottom = OVERLAY_BOTTOM_BY_LEVEL[level]
  const top = +(bottom * 0.2).toFixed(2)
  const mid = +(bottom * 0.733).toFixed(2)
  return `linear-gradient(180deg, rgba(0,0,0,${top}) 0%, rgba(0,0,0,${mid}) 45%, rgba(0,0,0,${bottom}) 100%)`
}

const GLASS_BUTTON = 'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-white bg-white/[0.15] backdrop-blur-[10px] border border-white/10 hover:bg-white/25 transition-colors duration-300'

export function StoreHero({ settings, storeName }: Props) {
  const { toast } = useToast()
  const { isFavorite, toggle } = useFavorites()
  const favorited = isFavorite(settings.slug)
  const brightness = useImageBrightness(settings.banner_url)
  const gradient = useMemo(() => overlayGradient(brightness), [brightness])

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
    <div className="relative w-full h-64 sm:h-72 lg:h-80 overflow-hidden">
      {settings.banner_url ? (
        <img src={settings.banner_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${settings.theme_color}, ${settings.theme_color}66)` }} />
      )}
      {/* Overlay escuro inteligente — mais forte quanto mais claro for o banner, para o texto nunca sumir */}
      <div className="absolute inset-0" style={{ background: gradient }} />

      <div className="absolute inset-x-0 bottom-0">
        <div className="max-w-6xl mx-auto px-4 pb-4 sm:pb-6">
          {/* Caixa de conteúdo — nunca deixa o texto "solto" direto sobre a imagem */}
          <div className="rounded-3xl bg-black/[0.35] backdrop-blur-[12px] border border-white/[0.08] p-5 sm:p-8 flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-lg overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white mb-3">
              {settings.logo_url ? <img src={settings.logo_url} alt={storeName} className="w-full h-full object-cover" /> : <Store size={28} className="text-text-muted" />}
            </div>

            <h1
              className="text-white font-bold text-xl sm:text-2xl lg:text-3xl"
              style={{ textShadow: '0 3px 15px rgba(0,0,0,.65)' }}
            >
              {storeName}
            </h1>

            {settings.city && (
              <p className="text-white/90 text-xs sm:text-sm flex items-center gap-1 mt-1.5">
                <MapPin size={12} /> {settings.city}{settings.state ? ` · ${settings.state}` : ''}
              </p>
            )}

            {settings.description && (
              <p
                className="text-white/95 text-sm max-w-2xl mt-2 line-clamp-2"
                style={{ textShadow: '0 2px 8px rgba(0,0,0,.60)' }}
              >
                {settings.description}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
              {settings.whatsapp && (
                <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className={GLASS_BUTTON}>
                  <MessageCircle size={13} /> WhatsApp
                </a>
              )}
              {settings.instagram && (
                <a href={`https://instagram.com/${settings.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className={GLASS_BUTTON}>
                  <Instagram size={13} /> Instagram
                </a>
              )}
              <button onClick={handleShare} className={GLASS_BUTTON}>
                <Share2 size={13} /> Compartilhar
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(storeUrl); toast('success', 'Link copiado!') }}
                className={GLASS_BUTTON}>
                <Link2 size={13} /> Copiar link
              </button>
              <button
                onClick={() => toggle(settings.slug)}
                className={clsx(GLASS_BUTTON, favorited && 'bg-error/80 border-error/50 hover:bg-error')}>
                <Heart size={13} className={favorited ? 'fill-current' : ''} /> {favorited ? 'Favoritado' : 'Favoritar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
