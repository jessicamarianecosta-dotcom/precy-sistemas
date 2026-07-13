'use client'

import { Search } from 'lucide-react'
import { ImageUploadField } from '@/components/catalog/ImageUploadField'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'

export function SeoCard({ value, onChange }: SettingsCardProps) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Search size={17} className="text-primary" /> SEO
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Essas informações ajudam sua loja aparecer no Google.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-text-muted mb-1 block">Título da página</label>
          <input className="input text-sm" placeholder="Ex: Lumilife — Comunicação Visual e Gráfica" value={value.seo_title ?? ''} onChange={e => onChange({ seo_title: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Descrição</label>
          <textarea className="input text-sm resize-none" rows={2} placeholder="Uma frase curta que resume sua loja para os resultados de busca." value={value.seo_description ?? ''} onChange={e => onChange({ seo_description: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Palavras-chave</label>
          <input className="input text-sm" placeholder="Ex: banner, adesivo, gráfica, comunicação visual" value={value.seo_keywords ?? ''} onChange={e => onChange({ seo_keywords: e.target.value })} />
        </div>
        <div className="max-w-xs">
          <ImageUploadField
            label="Imagem para compartilhamento"
            value={value.seo_image_url}
            onUploaded={url => onChange({ seo_image_url: url })}
            context="seo"
            recommendedSize="1200 x 630 px"
            recommendedFormat="PNG ou JPG"
            maxSizeMb={5}
            previewAspect="aspect-[1.91/1]"
            helpText="Aparece quando sua loja é compartilhada no WhatsApp, Instagram e redes sociais."
          />
        </div>
      </div>
    </div>
  )
}
