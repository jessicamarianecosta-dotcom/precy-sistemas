'use client'

import { clsx } from 'clsx'
import { Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Link2, X } from 'lucide-react'
import { ImageUploadField } from '@/components/catalog/ImageUploadField'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'
import type { BannerHeight, BannerImagePosition } from '@/components/catalog/storefront/types'

const HEIGHT_OPTIONS: { value: BannerHeight; label: string }[] = [
  { value: 'sm', label: 'Compacto' },
  { value: 'md', label: 'Médio' },
  { value: 'lg', label: 'Grande' },
]

const POSITION_OPTIONS: { value: BannerImagePosition; label: string; icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Esquerda', icon: AlignLeft },
  { value: 'center', label: 'Centro', icon: AlignCenter },
  { value: 'right', label: 'Direita', icon: AlignRight },
]

/**
 * Banner principal (hero) da vitrine pública — Seção 2 do redesign. Tudo o
 * que o lojista pode ajustar: imagem, altura, posicionamento, cantos
 * arredondados x largura total, exibir ou não texto sobre a imagem, e um
 * botão de destaque opcional (texto + link).
 */
export function BannerCard({ value, onChange }: SettingsCardProps) {
  return (
    <div className="card p-5 space-y-5">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <ImageIcon size={17} className="text-primary" /> Banner Principal
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          A primeira coisa que o cliente vê ao abrir sua loja. Você pode usar só a imagem, sem nenhum texto por cima, se preferir.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <ImageUploadField
            label="Imagem do banner"
            value={value.banner_url}
            onUploaded={url => onChange({ banner_url: url })}
            context="banner"
            recommendedSize="1920 x 500 px (proporção 3.84:1)"
            recommendedFormat="PNG ou JPG"
            maxSizeMb={5}
            previewAspect="aspect-[3.84/1]"
            showSafeArea={value.banner_show_text}
            helpText={value.banner_show_text
              ? 'As informações da loja aparecem nesta região. Um overlay escuro é aplicado automaticamente para manter o texto legível.'
              : 'Exibição "só imagem" ativada — o banner aparece limpo, sem textos sobrepostos.'}
          />
        </div>
        {value.banner_url && (
          <button
            type="button"
            onClick={() => onChange({ banner_url: null })}
            title="Remover imagem do banner"
            className="btn-secondary text-xs px-2.5 py-2 flex-shrink-0 mt-7"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="border-t border-border dark:border-border-dark pt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 mb-2">Altura do banner</p>
          <div className="inline-flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
            {HEIGHT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ banner_height: opt.value })}
                className={clsx(
                  'px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  value.banner_height === opt.value ? 'bg-primary text-white' : 'text-text-secondary dark:text-stone-400'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-text-secondary dark:text-stone-400 mb-2">Posicionamento da imagem</p>
          <div className="inline-flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
            {POSITION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ banner_image_position: opt.value })}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  value.banner_image_position === opt.value ? 'bg-primary text-white' : 'text-text-secondary dark:text-stone-400'
                )}
              >
                <opt.icon size={13} /> {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Cantos arredondados</p>
            <p className="text-xs text-text-muted dark:text-stone-500">Desative para o banner ocupar toda a largura da tela, sem margens.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={value.banner_rounded}
            onClick={() => onChange({ banner_rounded: !value.banner_rounded })}
            className={clsx('relative w-11 h-6 rounded-full transition-colors flex-shrink-0', value.banner_rounded ? 'bg-primary' : 'bg-border dark:bg-border-dark')}
          >
            <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', value.banner_rounded && 'translate-x-5')} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Exibir título e subtítulo</p>
            <p className="text-xs text-text-muted dark:text-stone-500">Desative para mostrar só a imagem do banner, sem nome, descrição ou botões por cima.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={value.banner_show_text}
            onClick={() => onChange({ banner_show_text: !value.banner_show_text })}
            className={clsx('relative w-11 h-6 rounded-full transition-colors flex-shrink-0', value.banner_show_text ? 'bg-primary' : 'bg-border dark:bg-border-dark')}
          >
            <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', value.banner_show_text && 'translate-x-5')} />
          </button>
        </div>
      </div>

      {value.banner_show_text && (
        <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-primary" />
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Botão de destaque (opcional)</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Texto do botão</label>
              <input
                className="input"
                placeholder="Ex: Ver promoções"
                value={value.banner_button_text ?? ''}
                onChange={e => onChange({ banner_button_text: e.target.value || null })}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Link do botão</label>
              <input
                className="input"
                placeholder="Ex: #produtos ou https://..."
                value={value.banner_button_link ?? ''}
                onChange={e => onChange({ banner_button_link: e.target.value || null })}
              />
            </div>
          </div>
          <p className="text-[11px] text-text-muted dark:text-stone-500">
            Deixe os dois campos em branco para não exibir nenhum botão sobre o banner.
          </p>
        </div>
      )}
    </div>
  )
}
