'use client'

import { Store, MessageCircle, Instagram, Eye } from 'lucide-react'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'
import { getBackgroundTheme } from '@/lib/catalog/theme/backgroundThemes'
import { resolvePalettes } from '@/lib/catalog/theme/palette'

const OBJECT_POSITION: Record<string, string> = { left: 'left center', center: 'center', right: 'right center' }

/** Recorte compacto do hero + fundo reais da loja, recalculado a cada mudança do form (sem precisar salvar). */
export function StorePreviewCard({ value }: SettingsCardProps) {
  const showText = value.banner_show_text ?? true
  const rounded = value.banner_rounded ?? true
  const palettes = resolvePalettes(value)

  let bodyBackground = palettes.light.background
  if (value.background_type === 'color' && value.background_color) {
    bodyBackground = value.background_color
  } else if (value.background_type === 'theme') {
    const theme = getBackgroundTheme(value.background_theme)
    bodyBackground = theme.css('light')
      .replaceAll('var(--store-primary)', palettes.light.primary)
      .replaceAll('var(--store-secondary)', palettes.light.secondary)
      .replaceAll('var(--store-accent)', palettes.light.accent)
      .replaceAll('var(--store-bg)', palettes.light.background)
      .replaceAll('var(--store-surface)', palettes.light.surface)
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Eye size={17} className="text-primary" /> Preview da Loja
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Veja como ficará em tempo real, antes mesmo de salvar — banner e fundo inclusos.
        </p>
      </div>

      <div
        className="relative rounded-2xl overflow-hidden border border-border dark:border-border-dark"
        style={value.background_type === 'image' && value.background_image_url
          ? { backgroundImage: `url(${value.background_image_url})`, backgroundSize: value.background_image_size === 'repeat' ? 'auto' : value.background_image_size, backgroundRepeat: value.background_image_size === 'repeat' ? 'repeat' : 'no-repeat', backgroundPosition: value.background_image_position }
          : { background: bodyBackground }}
      >
        <div className={`relative h-28 sm:h-36 bg-surface dark:bg-white/5 ${rounded ? 'mx-2 mt-2 rounded-xl overflow-hidden' : ''}`}>
          {value.banner_url ? (
            <img
              src={value.banner_url}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: OBJECT_POSITION[value.banner_image_position] ?? 'center' }}
            />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${value.theme_color}, ${value.theme_color}99)` }} />
          )}

          {showText && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white">
                  {value.logo_url ? <img src={value.logo_url} alt="" className="w-full h-full object-cover" /> : <Store size={18} className="text-text-muted" />}
                </div>
                <div className="min-w-0 pb-0.5">
                  <p className="text-white font-bold text-sm truncate drop-shadow">Sua Loja</p>
                  {value.city && <p className="text-white/80 text-[10px] truncate">{value.city}{value.state ? ` · ${value.state}` : ''}</p>}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-3 space-y-2">
          {showText && value.banner_button_text && (
            <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: palettes.light.primary, color: palettes.light.buttonText }}>
              {value.banner_button_text}
            </span>
          )}
          {value.description && (
            <p className="text-xs text-text-secondary dark:text-stone-400 line-clamp-2">{value.description}</p>
          )}
          <div className="flex items-center gap-3">
            {value.whatsapp && (
              <span className="flex items-center gap-1 text-[11px] text-text-muted"><MessageCircle size={11} /> WhatsApp</span>
            )}
            {value.instagram && (
              <span className="flex items-center gap-1 text-[11px] text-text-muted"><Instagram size={11} /> Instagram</span>
            )}
            <span
              className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
              style={{ backgroundColor: value.theme_color }}
            >
              Comprar
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
