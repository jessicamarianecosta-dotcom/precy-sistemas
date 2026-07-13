'use client'

import { MessageCircle, Instagram, Facebook, Youtube, Globe, MapPin } from 'lucide-react'
import type { StorefrontSettings } from './types'

interface Props {
  settings:  StorefrontSettings
  storeName: string
}

export function StoreFooter({ settings, storeName }: Props) {
  const hasSocial = settings.whatsapp || settings.instagram || settings.facebook || settings.youtube || settings.website

  return (
    <footer className="border-t border-border dark:border-border-dark mt-8">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        {hasSocial && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary dark:text-stone-400">
            {settings.whatsapp && (
              <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
            {settings.instagram && (
              <a href={`https://instagram.com/${settings.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Instagram size={14} /> Instagram
              </a>
            )}
            {settings.facebook && (
              <a href={settings.facebook.startsWith('http') ? settings.facebook : `https://${settings.facebook}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Facebook size={14} /> Facebook
              </a>
            )}
            {settings.youtube && (
              <a href={settings.youtube.startsWith('http') ? settings.youtube : `https://${settings.youtube}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Youtube size={14} /> YouTube
              </a>
            )}
            {settings.website && (
              <a href={settings.website.startsWith('http') ? settings.website : `https://${settings.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Globe size={14} /> Site
              </a>
            )}
          </div>
        )}

        {(settings.city || settings.address) && (
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <MapPin size={12} />
            {[settings.address, settings.city, settings.state].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pt-3 border-t border-border dark:border-border-dark text-[11px] text-text-muted">
          <p>© {new Date().getFullYear()} {storeName}. Todos os direitos reservados.</p>
          <p>Powered by <span className="font-semibold text-primary">Precy+</span></p>
        </div>
      </div>
    </footer>
  )
}
