'use client'

import Image from 'next/image'
import { getBackgroundTheme } from '@/lib/catalog/theme/backgroundThemes'
import type { StorefrontSettings } from './types'

interface Props {
  settings: Pick<
    StorefrontSettings,
    | 'background_type' | 'background_theme' | 'background_color' | 'background_image_url'
    | 'background_image_size' | 'background_image_position' | 'background_overlay_opacity'
  >
}

/**
 * Camada de fundo de toda a vitrine pública (Seção 3 do redesign) — fica fixa
 * por trás de cabeçalho, banner, categorias, produtos e rodapé. Os cards
 * (ProductCard, StoreHeader, StoreFooter) continuam usando `var(--store-surface)`
 * opaco, então contraste e legibilidade não dependem deste componente.
 *
 * Três fontes possíveis (mutuamente exclusivas, Seção 3 do pedido):
 *  - 'color': cor sólida escolhida pela lojista
 *  - 'image': imagem própria, com tamanho/posição configuráveis + overlay
 *  - 'theme': um dos 8 temas prontos (ilustrações fixas + overlay de contraste)
 */
export function StoreBackground({ settings }: Props) {
  if (settings.background_type === 'image' && settings.background_image_url) {
    const size = settings.background_image_size ?? 'cover'
    const position = settings.background_image_position ?? 'center'
    const opacity = settings.background_overlay_opacity ?? 0.35

    return (
      <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: 'var(--store-bg)' }}>
        {size === 'repeat' ? (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `url(${settings.background_image_url})`, backgroundRepeat: 'repeat', backgroundPosition: position }}
          />
        ) : (
          <Image
            src={settings.background_image_url}
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: size === 'contain' ? 'contain' : 'cover', objectPosition: position }}
          />
        )}
        {/* Camada de contraste — garante que cards e textos continuem legíveis sobre a imagem */}
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--store-bg)', opacity }} />
      </div>
    )
  }

  if (settings.background_type === 'color' && settings.background_color) {
    return <div className="fixed inset-0 -z-10" style={{ backgroundColor: settings.background_color }} />
  }

  const theme = getBackgroundTheme(settings.background_theme)
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: 'var(--store-bg)' }}>
      <Image src={theme.image} alt="" fill sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'center' }} />
      {/* Camada de contraste — garante que cards e textos continuem legíveis sobre a imagem do tema */}
      <div className="absolute inset-0" style={{ backgroundColor: 'var(--store-bg)', opacity: 0.22 }} />
    </div>
  )
}
