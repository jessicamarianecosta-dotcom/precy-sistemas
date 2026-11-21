'use client'

import { clsx } from 'clsx'
import { Sparkles, ImageIcon, Paintbrush, X } from 'lucide-react'
import { ImageUploadField } from '@/components/catalog/ImageUploadField'
import { BACKGROUND_THEMES } from '@/lib/catalog/theme/backgroundThemes'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'
import type { BackgroundType, BackgroundImageSize, BannerImagePosition } from '@/components/catalog/storefront/types'

const SOURCE_OPTIONS: { value: BackgroundType; label: string; icon: typeof Sparkles }[] = [
  { value: 'theme', label: 'Temas prontos', icon: Sparkles },
  { value: 'image', label: 'Imagem própria', icon: ImageIcon },
  { value: 'color', label: 'Cor sólida', icon: Paintbrush },
]

const SIZE_OPTIONS: { value: BackgroundImageSize; label: string }[] = [
  { value: 'cover', label: 'Cobrir tudo' },
  { value: 'contain', label: 'Ajustar' },
  { value: 'repeat', label: 'Repetir (mosaico)' },
]

const POSITION_OPTIONS: { value: BannerImagePosition; label: string }[] = [
  { value: 'left', label: 'Esquerda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Direita' },
]

/**
 * "Aparência da Loja" — Seção 3 do redesign (marcada como muito importante
 * pela lojista). Controla o fundo de TODA a vitrine pública, não só do
 * banner: imagem própria, um dos 8 temas prontos, ou uma cor sólida.
 */
export function StoreBackgroundCard({ value, onChange }: SettingsCardProps) {
  return (
    <div className="card p-5 space-y-5">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Sparkles size={17} className="text-primary" /> Aparência da Loja
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Personalize o fundo de toda a vitrine — não só do banner. Os cards de produtos e categorias continuam sempre legíveis, qualquer que seja a opção escolhida.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
        {SOURCE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ background_type: opt.value })}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-colors',
              value.background_type === opt.value ? 'bg-primary text-white' : 'text-text-secondary dark:text-stone-400'
            )}
          >
            <opt.icon size={13} /> {opt.label}
          </button>
        ))}
      </div>

      {value.background_type === 'theme' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BACKGROUND_THEMES.map(theme => {
            const active = value.background_theme === theme.id
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onChange({ background_theme: theme.id })}
                title={theme.blurb}
                className={clsx(
                  'rounded-xl border-2 overflow-hidden text-left transition-colors',
                  active ? 'border-primary' : 'border-border dark:border-border-dark hover:border-primary/50'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={theme.image} alt="" className="h-14 w-full object-cover" />
                <p className={clsx('px-2 py-1.5 text-xs font-semibold', active && 'text-primary')}>{theme.label}</p>
              </button>
            )
          })}
        </div>
      )}

      {value.background_type === 'image' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 max-w-sm">
              <ImageUploadField
                label="Imagem de fundo"
                value={value.background_image_url}
                onUploaded={url => onChange({ background_image_url: url })}
                context="background"
                recommendedSize="2000 x 2000 px ou maior"
                recommendedFormat="PNG, JPG ou WEBP"
                maxSizeMb={8}
                previewAspect="aspect-video"
                helpText="Fica por trás de toda a loja. Evite imagens com muito contraste para não prejudicar a leitura."
              />
            </div>
            {value.background_image_url && (
              <button
                type="button"
                onClick={() => onChange({ background_image_url: null })}
                title="Remover imagem de fundo"
                className="btn-secondary text-xs px-2.5 py-2 flex-shrink-0 mt-7"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 mb-2">Tamanho</p>
            <div className="inline-flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
              {SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ background_image_size: opt.value })}
                  className={clsx('px-3 py-1.5 text-xs font-semibold', value.background_image_size === opt.value ? 'bg-primary text-white' : 'text-text-secondary dark:text-stone-400')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 mb-2">Posicionamento</p>
            <div className="inline-flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
              {POSITION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ background_image_position: opt.value })}
                  className={clsx('px-3 py-1.5 text-xs font-semibold', value.background_image_position === opt.value ? 'bg-primary text-white' : 'text-text-secondary dark:text-stone-400')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary dark:text-stone-400 mb-2 flex items-center justify-between">
              <span>Opacidade da camada de contraste</span>
              <span className="font-mono">{Math.round(value.background_overlay_opacity * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={value.background_overlay_opacity}
              onChange={e => onChange({ background_overlay_opacity: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[11px] text-text-muted dark:text-stone-500 mt-1">
              Aumente se os textos e cards ficarem difíceis de ler sobre a imagem.
            </p>
          </div>
        </div>
      )}

      {value.background_type === 'color' && (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={value.background_color ?? '#FFFFFF'}
            onChange={e => onChange({ background_color: e.target.value })}
            className="w-12 h-12 rounded-xl border border-border dark:border-border-dark cursor-pointer"
          />
          <div>
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Cor de fundo</p>
            <p className="text-xs font-mono text-text-muted dark:text-stone-500">{value.background_color ?? '—'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
