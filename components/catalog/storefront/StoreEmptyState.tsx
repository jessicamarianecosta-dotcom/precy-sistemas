'use client'

import { PackageSearch, MessageCircle } from 'lucide-react'

interface Props {
  whatsapp?: string | null
}

export function StoreEmptyState({ whatsapp }: Props) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--store-primary) 12%, transparent)' }}>
        <PackageSearch size={28} className="text-[var(--store-primary)]" />
      </div>
      <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-1.5">
        Esta loja ainda não possui produtos publicados.
      </h3>
      <p className="text-sm text-text-muted max-w-sm mb-5">
        Volte em breve — novos produtos podem aparecer aqui a qualquer momento.
      </p>
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
          target="_blank" rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
        >
          <MessageCircle size={15} /> Entrar em contato
        </a>
      )}
    </div>
  )
}
