'use client'

import { PackageSearch, MessageCircle } from 'lucide-react'

interface Props {
  whatsapp?: string | null
}

export function StoreEmptyState({ whatsapp }: Props) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center mb-4">
        <PackageSearch size={28} className="text-primary" />
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
          className="btn-primary flex items-center gap-2"
        >
          <MessageCircle size={15} /> Entrar em contato
        </a>
      )}
    </div>
  )
}
