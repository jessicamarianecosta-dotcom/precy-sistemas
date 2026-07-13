'use client'

import { Instagram, Facebook, Youtube, Globe, MessageCircle, Share2 } from 'lucide-react'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'
import type { CatalogSettings } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'

const FIELDS: { key: keyof CatalogSettings; label: string; icon: React.ElementType; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', icon: Instagram,     placeholder: '@sualoja' },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle, placeholder: '11999999999' },
  { key: 'facebook',  label: 'Facebook',  icon: Facebook,      placeholder: 'facebook.com/sualoja' },
  { key: 'tiktok',    label: 'TikTok',    icon: Share2,        placeholder: '@sualoja' },
  { key: 'youtube',   label: 'YouTube',   icon: Youtube,       placeholder: 'youtube.com/@sualoja' },
  { key: 'pinterest', label: 'Pinterest', icon: Share2,        placeholder: 'pinterest.com/sualoja' },
  { key: 'website',   label: 'Site',      icon: Globe,         placeholder: 'www.sualoja.com.br' },
]

export function SocialLinksCard({ value, onChange }: SettingsCardProps) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Share2 size={17} className="text-primary" /> Redes Sociais
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Só aparecem na sua loja pública quando preenchidas.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {FIELDS.map(f => {
          const Icon = f.icon
          const filled = value[f.key]
          return (
            <div key={f.key} className="relative">
              <Icon size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${filled ? 'text-primary' : 'text-text-muted'}`} />
              <input
                className="input pl-9 text-sm"
                placeholder={`${f.label} · ${f.placeholder}`}
                value={(value[f.key] as string) ?? ''}
                onChange={e => onChange({ [f.key]: e.target.value } as Partial<CatalogSettings>)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
