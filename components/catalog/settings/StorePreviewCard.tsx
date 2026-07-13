'use client'

import { Store, MessageCircle, Instagram, Eye } from 'lucide-react'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'

/** Recorte compacto do hero real da loja, recalculado a cada mudança do form (sem precisar salvar). */
export function StorePreviewCard({ value }: SettingsCardProps) {
  return (
    <div className="card p-5 space-y-3">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <Eye size={17} className="text-primary" /> Preview da Loja
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Veja como ficará em tempo real, antes mesmo de salvar.
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden border border-border dark:border-border-dark">
        <div className="relative h-28 sm:h-36 bg-surface dark:bg-white/5">
          {value.banner_url ? (
            <img src={value.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${value.theme_color}, ${value.theme_color}99)` }} />
          )}
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
        </div>

        <div className="p-3 space-y-2 bg-white dark:bg-surface-dark">
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
