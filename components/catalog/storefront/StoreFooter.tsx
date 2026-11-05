'use client'

import Image from 'next/image'
import { MessageCircle, Instagram, Facebook, Youtube, Globe, MapPin, Clock, Store } from 'lucide-react'
import type { StorefrontSettings } from './types'

interface Props {
  settings:  StorefrontSettings
  storeName: string
}

export function StoreFooter({ settings, storeName }: Props) {
  const hasSocial = settings.whatsapp || settings.instagram || settings.facebook || settings.youtube || settings.website

  return (
    <footer id="contato" className="border-t border-border dark:border-border-dark mt-8 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-start gap-3">
          <div className="relative w-12 h-12 rounded-xl bg-white shadow-sm overflow-hidden flex items-center justify-center flex-shrink-0 border border-border dark:border-border-dark">
            {settings.logo_url ? <Image src={settings.logo_url} alt={storeName} fill sizes="48px" className="object-cover" /> : <Store size={20} className="text-text-muted" />}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm" style={{ color: 'var(--store-text)' }}>{storeName}</p>
            {settings.description && (
              <p className="text-xs text-text-secondary dark:text-stone-400 mt-1 max-w-md">{settings.description}</p>
            )}
          </div>
        </div>

        {hasSocial && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary dark:text-stone-400">
            {settings.whatsapp && (
              <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[var(--store-primary)] transition-colors">
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
            {settings.instagram && (
              <a href={`https://instagram.com/${settings.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[var(--store-primary)] transition-colors">
                <Instagram size={14} /> Instagram
              </a>
            )}
            {settings.facebook && (
              <a href={settings.facebook.startsWith('http') ? settings.facebook : `https://${settings.facebook}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[var(--store-primary)] transition-colors">
                <Facebook size={14} /> Facebook
              </a>
            )}
            {settings.youtube && (
              <a href={settings.youtube.startsWith('http') ? settings.youtube : `https://${settings.youtube}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[var(--store-primary)] transition-colors">
                <Youtube size={14} /> YouTube
              </a>
            )}
            {settings.website && (
              <a href={settings.website.startsWith('http') ? settings.website : `https://${settings.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[var(--store-primary)] transition-colors">
                <Globe size={14} /> Site
              </a>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
          {(settings.city || settings.address) && (
            <p className="flex items-center gap-1.5">
              <MapPin size={12} />
              {[settings.address, settings.city, settings.state].filter(Boolean).join(' · ')}
            </p>
          )}
          {settings.business_hours && (
            <p className="flex items-center gap-1.5">
              <Clock size={12} /> {settings.business_hours}
            </p>
          )}
        </div>

        {settings.policies_text && (
          <div className="pt-3 border-t border-border dark:border-border-dark">
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--store-text)' }}>Políticas da loja</p>
            <p className="text-xs text-text-secondary dark:text-stone-400 whitespace-pre-line">{settings.policies_text}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pt-3 border-t border-border dark:border-border-dark text-[11px] text-text-muted">
          <p>© {new Date().getFullYear()} {storeName}. Todos os direitos reservados.</p>
          <p>Powered by <span className="font-semibold text-primary">Precy+</span></p>
        </div>
      </div>
    </footer>
  )
}
