'use client'

import { clsx } from 'clsx'
import Image from 'next/image'
import type { StorefrontSettings } from './types'

interface Props {
  settings:  StorefrontSettings
  storeName: string
}

// A altura configurada (Compacto/Médio/Grande) só faz sentido quando o banner
// tem largura limitada (max-w-6xl, modo "cantos arredondados") — nesse caso a
// largura real do container é sempre parecida, então uma altura fixa não
// corta muito. No mobile, mesmo nesse modo, a largura cai bastante (telas
// estreitas), então usamos a proporção real da imagem (aspect-ratio) em vez
// da altura fixa, e só aplicamos a altura configurada do tablet (sm) em diante.
const HEIGHT_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'aspect-[1920/500] sm:aspect-auto sm:min-h-56 lg:min-h-64',
  md: 'aspect-[1920/500] sm:aspect-auto sm:min-h-72 lg:min-h-80',
  lg: 'aspect-[1920/500] sm:aspect-auto sm:min-h-96 lg:min-h-[28rem]',
}

const OBJECT_POSITION: Record<'left' | 'center' | 'right', string> = {
  left: 'left center',
  center: 'center',
  right: 'right center',
}

/**
 * Banner (hero) da vitrine pública — só a imagem enviada pelo lojista, sem
 * nenhum painel de informações sobreposto. O único elemento opcional é o
 * botão de destaque configurado em Configurações → Banner.
 */
export function StoreHero({ settings, storeName }: Props) {
  const heightClass = HEIGHT_CLASSES[settings.banner_height ?? 'md']
  const objectPosition = OBJECT_POSITION[settings.banner_image_position ?? 'center']
  const rounded = settings.banner_rounded ?? true
  const hasButton = !!settings.banner_button_text && !!settings.banner_button_link

  if (!settings.banner_url) return null

  return (
    <div className="relative w-full">
      <div className={clsx(
        'relative w-full overflow-hidden',
        rounded ? clsx('max-w-6xl mx-auto mt-4 rounded-3xl', heightClass) : 'aspect-[1920/500]'
      )}>
        <Image src={settings.banner_url} alt={storeName} fill sizes="100vw" priority className="object-cover" style={{ objectPosition }} />

        {hasButton && (
          <div className="absolute inset-x-0 bottom-5 sm:bottom-6 flex justify-center">
            <a
              href={settings.banner_button_link!}
              target={settings.banner_button_link!.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-bold shadow-lg transition-transform hover:scale-105"
              style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
            >
              {settings.banner_button_text}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
