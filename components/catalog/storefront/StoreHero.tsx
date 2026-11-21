'use client'

import { useMemo, type ReactNode } from 'react'
import Image from 'next/image'
import { Store, MessageCircle, Instagram, Share2, Link2, Heart, MapPin, ShieldCheck, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { useToast } from '@/components/ui/Toaster'
import { useFavorites } from '@/lib/catalog/useFavorites'
import { useImageBrightness } from '@/lib/catalog/useImageBrightness'
import type { StorefrontSettings } from './types'

interface Category { id: string; name: string }

interface Props {
  settings:   StorefrontSettings
  storeName:  string
  categories?: Category[]
  themeToggle?: ReactNode
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
const NAME_SHADOW = { textShadow: '0 3px 15px rgba(0,0,0,.65)' }
const DESC_SHADOW = { textShadow: '0 2px 8px rgba(0,0,0,.60)' }

const HEIGHT_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-h-48 sm:min-h-56 lg:min-h-64',
  md: 'min-h-64 sm:min-h-72 lg:min-h-80',
  lg: 'min-h-80 sm:min-h-96 lg:min-h-[28rem]',
}

const OBJECT_POSITION: Record<'left' | 'center' | 'right', string> = {
  left: 'left center',
  center: 'center',
  right: 'right center',
}

export function StoreHero({ settings, storeName, categories = [], themeToggle }: Props) {
  const { toast } = useToast()
  const { isFavorite, toggle } = useFavorites()
  const favorited = isFavorite(settings.slug)
  const brightness = useImageBrightness(settings.banner_url)
  const gradient = useMemo(() => overlayGradient(brightness), [brightness])

  const storeUrl = typeof window !== 'undefined' ? window.location.href : ''
  const heightClass = HEIGHT_CLASSES[settings.banner_height ?? 'md']
  const objectPosition = OBJECT_POSITION[settings.banner_image_position ?? 'center']
  const rounded = settings.banner_rounded ?? true
  const showText = settings.banner_show_text ?? true
  const hasButton = showText && !!settings.banner_button_text && !!settings.banner_button_link

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
    <div className="relative w-full">
      {/* Foto de fundo em tela cheia — cresce junto com o conteúdo, nunca corta o texto */}
      <div className="absolute inset-0 overflow-hidden">
        {settings.banner_url ? (
          <Image src={settings.banner_url} alt="" fill sizes="100vw" priority className="object-cover" style={{ objectPosition }} />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--store-primary), var(--store-accent))' }} />
        )}
        {/* Overlay escuro inteligente — só quando há texto sobre a imagem (mesmo caso contrário, ainda ajuda a loja vazia) */}
        {(showText || !settings.banner_url) && <div className="absolute inset-0" style={{ background: gradient }} />}
      </div>

      <div className={clsx('relative flex items-end', heightClass)}>
        {!showText ? (
          // Modo "só imagem" — nenhum texto/badge/botão sobreposto ao banner.
          <div className="w-full" />
        ) : (
        <div className={clsx('mx-auto w-full', rounded ? 'max-w-6xl px-4 pb-4 sm:pb-6' : 'px-0 pb-0')}>
          {/* Caixa de conteúdo — nunca deixa o texto "solto" direto sobre a imagem */}
          <div className={clsx(
            'bg-black/[0.35] backdrop-blur-[12px] border border-white/[0.08] p-5 sm:p-8',
            rounded ? 'rounded-3xl' : 'rounded-none border-x-0 max-w-6xl mx-auto px-4 sm:px-8'
          )}>
            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 sm:gap-6 items-start">
              {/* Coluna 1 — Logo (permanece exatamente onde está) */}
              <div className="flex justify-center sm:justify-start">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-lg overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white">
                  {settings.logo_url ? <Image src={settings.logo_url} alt={storeName} fill sizes="80px" className="object-cover" /> : <Store size={28} className="text-text-muted" />}
                </div>
              </div>

              {/* Coluna 2 — todo o conteúdo textual, usando toda a largura disponível */}
              <div className="min-w-0 text-center sm:text-left">
                <h1 className="text-white font-bold text-xl sm:text-2xl lg:text-3xl line-clamp-2" style={NAME_SHADOW}>
                  {storeName}
                </h1>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success text-white">
                    <ShieldCheck size={12} /> Loja Verificada
                  </span>
                  {settings.whatsapp && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/20 text-white backdrop-blur-sm border border-white/10">
                      <Zap size={12} /> Responde rápido
                    </span>
                  )}
                  {settings.city && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-white/90">
                      <MapPin size={12} /> {settings.city}{settings.state ? ` · ${settings.state}` : ''}
                    </span>
                  )}
                </div>

                {settings.description && (
                  <p className="text-white/95 text-sm mt-3 line-clamp-4" style={DESC_SHADOW}>
                    {settings.description}
                  </p>
                )}

                {categories.length > 0 && (
                  <div className="mt-3">
                    <p className="text-white/90 text-xs font-semibold" style={DESC_SHADOW}>Aqui você encontra:</p>
                    <ul className="text-white/85 text-xs mt-1 flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-0.5">
                      {categories.slice(0, 6).map(c => <li key={c.id}>• {c.name}</li>)}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
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
                    <Heart size={13} className={favorited ? 'fill-current' : ''} /> {favorited ? 'Loja favoritada' : 'Favoritar loja'}
                  </button>
                  {themeToggle}
                </div>

                {hasButton && (
                  <div className="mt-4">
                    <a
                      href={settings.banner_button_link!}
                      target={settings.banner_button_link!.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg transition-transform hover:scale-105"
                      style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
                    >
                      {settings.banner_button_text}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
