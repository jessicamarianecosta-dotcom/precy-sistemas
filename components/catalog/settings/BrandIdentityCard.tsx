'use client'

import { Palette } from 'lucide-react'
import { ImageUploadField } from '@/components/catalog/ImageUploadField'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'

export function BrandIdentityCard({ value, onChange }: SettingsCardProps) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Palette size={17} className="text-primary" /> Identidade Visual
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          O logo aparecerá na sua loja, nos produtos e nas páginas públicas.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="max-w-[220px]">
          <ImageUploadField
            label="Logo"
            value={value.logo_url}
            onUploaded={url => onChange({ logo_url: url })}
            context="logo"
            recommendedSize="120 x 120 px"
            recommendedFormat="PNG, fundo transparente"
            maxSizeMb={2}
            previewAspect="aspect-square"
            helpText="Proporção 1:1 — imagens quadradas ficam melhores."
          />
        </div>

        <div>
          <ImageUploadField
            label="Banner"
            value={value.banner_url}
            onUploaded={url => onChange({ banner_url: url })}
            context="banner"
            recommendedSize="1920 x 500 px (proporção 3.84:1)"
            recommendedFormat="PNG ou JPG"
            maxSizeMb={5}
            previewAspect="aspect-[3.84/1]"
            showSafeArea
            helpText="As informações da loja serão exibidas nesta região. Evite colocar textos importantes atrás do logo ou na parte inferior do banner — um overlay escuro é aplicado automaticamente para garantir a leitura, mas prefira imagens leves e de alta qualidade."
          />
        </div>
      </div>
    </div>
  )
}
