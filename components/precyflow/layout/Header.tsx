'use client'

import { Menu, Search } from 'lucide-react'

export function Header({
  storeName,
  userEmail,
  onOpenMobile,
}: {
  storeName: string
  userEmail: string | null
  onOpenMobile: () => void
}) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 lg:px-8"
      style={{ backgroundColor: 'var(--pf-surface)', borderBottom: '1px solid var(--pf-border)' }}
    >
      <div className="flex items-center gap-3">
        <button onClick={onOpenMobile} className="lg:hidden" aria-label="Abrir menu" style={{ color: 'var(--pf-text-secondary)' }}>
          <Menu size={22} />
        </button>
        <div className="hidden sm:flex items-center gap-2 rounded-xl px-3 py-2" style={{ border: '1px solid var(--pf-border)' }}>
          <Search size={16} style={{ color: 'var(--pf-text-muted)' }} />
          <input
            placeholder="Buscar no PrecyFlow..."
            className="bg-transparent text-sm outline-none w-48"
            style={{ color: 'var(--pf-text)' }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
        <span className="font-medium" style={{ color: 'var(--pf-text)' }}>{storeName}</span>
        {userEmail && <span className="hidden sm:inline">· {userEmail}</span>}
      </div>
    </header>
  )
}
