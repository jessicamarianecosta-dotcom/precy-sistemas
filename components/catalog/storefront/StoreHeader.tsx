'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Store, Search, Heart, ShoppingBag, Menu, X } from 'lucide-react'
import { StoreThemeToggle } from './StoreThemeRoot'

interface Props {
  slug:            string
  storeName:       string
  logoUrl?:        string | null
  cartCount:       number
  favoriteCount:   number
}

const NAV_LINKS = (slug: string) => [
  { label: 'Início', href: `/loja/${slug}` },
  { label: 'Categorias', href: `/loja/${slug}#categorias` },
  { label: 'Todos os produtos', href: `/loja/${slug}#produtos` },
  { label: 'Novidades', href: `/loja/${slug}?view=novidades#produtos` },
  { label: 'Mais vendidos', href: `/loja/${slug}?view=mais-vendidos#produtos` },
  { label: 'Contato', href: `/loja/${slug}#contato` },
]

/**
 * Cabeçalho fixo da loja pública — logo, navegação, busca, favoritos e sacola
 * acessíveis em qualquer página da loja (listagem, produto, checkout, pedido).
 */
export function StoreHeader({ slug, storeName, logoUrl, cartCount, favoriteCount }: Props) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchValue.trim()
    router.push(q ? `/loja/${slug}?busca=${encodeURIComponent(q)}#produtos` : `/loja/${slug}#produtos`)
    setSearchOpen(false)
    setMobileOpen(false)
  }

  const links = NAV_LINKS(slug)

  return (
    <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: 'var(--store-surface)', borderColor: 'var(--store-border)' }}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href={`/loja/${slug}`} className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <div className="relative w-8 h-8 rounded-lg bg-white shadow-sm overflow-hidden flex items-center justify-center flex-shrink-0 border" style={{ borderColor: 'var(--store-border)' }}>
            {logoUrl ? <Image src={logoUrl} alt={storeName} fill sizes="32px" className="object-cover" /> : <Store size={15} className="text-text-muted" />}
          </div>
          <span className="font-bold text-sm truncate max-w-[140px] sm:max-w-[220px]" style={{ color: 'var(--store-text)' }}>{storeName}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-4 flex-1 justify-center">
          {links.map(link => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium whitespace-nowrap transition-colors hover:opacity-70"
              style={{ color: 'var(--store-text-secondary)' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 ml-auto">
          <StoreThemeToggle
            className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity text-[var(--store-text)]"
          />
          <button
            type="button"
            onClick={() => setSearchOpen(o => !o)}
            title="Buscar"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ color: 'var(--store-text)' }}
          >
            <Search size={17} />
          </button>
          <Link
            href={`/loja/${slug}/favoritos`}
            title="Favoritos"
            className="relative w-9 h-9 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ color: 'var(--store-text)' }}
          >
            <Heart size={17} />
            {favoriteCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-error text-white text-[9px] font-bold flex items-center justify-center">{favoriteCount}</span>
            )}
          </Link>
          <Link
            href={`/loja/${slug}/checkout`}
            title="Sacola"
            className="relative w-9 h-9 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ color: 'var(--store-text)' }}
          >
            <ShoppingBag size={17} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-error text-white text-[9px] font-bold flex items-center justify-center">{cartCount}</span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            title="Menu"
            className="md:hidden w-9 h-9 rounded-full flex items-center justify-center"
            style={{ color: 'var(--store-text)' }}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submitSearch} className="border-t px-4 py-2.5" style={{ borderColor: 'var(--store-border)' }}>
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <input
              autoFocus
              className="input h-10 text-sm flex-1"
              placeholder="O que você procura?"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
            />
            <button type="submit" className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}>
              Buscar
            </button>
          </div>
        </form>
      )}

      {mobileOpen && (
        <nav className="md:hidden border-t px-4 py-2 flex flex-col" style={{ borderColor: 'var(--store-border)' }}>
          {links.map(link => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="py-2.5 text-sm font-medium border-b last:border-0"
              style={{ color: 'var(--store-text-secondary)', borderColor: 'var(--store-border)' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
