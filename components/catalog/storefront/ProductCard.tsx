'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Store, Heart } from 'lucide-react'
import { clsx } from 'clsx'
import { formatCurrency } from '@/lib/utils/format'
import { isNewProduct } from '@/lib/catalog/productFlags'
import { useProductFavorites } from '@/lib/catalog/useProductFavorites'
import type { StorefrontProduct } from './types'

interface Props {
  slug:         string
  product:      StorefrontProduct
  href:         string
  isBestseller: boolean
}

export function ProductCard({ slug, product, href, isBestseller }: Props) {
  const price = product.catalog_starting_price ?? product.final_price
  const hasPromo = product.catalog_promo_price != null && product.catalog_promo_price < price
  const photo = product.images?.[0]?.url ?? product.catalog_photos?.[0]
  const { isFavorite, toggle } = useProductFavorites(slug)
  const favorited = isFavorite(product.id)

  const isNew = isNewProduct(product.created_at)

  const badge = hasPromo ? { label: 'Promoção', className: 'bg-error text-white' }
    : isBestseller ? { label: 'Mais vendido', className: 'bg-amber-500 text-white' }
    : isNew ? { label: 'Novo', className: 'text-[var(--store-button-text)] bg-[var(--store-primary)]' }
    : null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={href}
        className="group card overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 block"
      >
        <div className="relative aspect-square bg-surface dark:bg-white/5 flex items-center justify-center overflow-hidden">
          {photo ? (
            <Image src={photo} alt={product.name} fill sizes="(max-width: 640px) 50vw, 300px" className="object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <Store size={32} className="text-text-muted" />
          )}
          {badge && (
            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${badge.className}`}>
              {badge.label}
            </span>
          )}
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(product.id) }}
            title={favorited ? 'Remover dos favoritos' : 'Favoritar'}
            className={clsx(
              'absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors',
              favorited ? 'bg-error text-white' : 'bg-white/80 text-text-muted hover:text-error dark:bg-black/40'
            )}
          >
            <Heart size={13} className={favorited ? 'fill-current' : ''} />
          </button>
        </div>
        <div className="p-3">
          <p className="text-sm font-medium text-text-primary dark:text-stone-100 line-clamp-2 mb-1.5 min-h-[2.5em]">{product.name}</p>
          {hasPromo ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-error">{formatCurrency(product.catalog_promo_price!)}</span>
              <span className="text-xs text-text-muted line-through">{formatCurrency(price)}</span>
            </div>
          ) : (
            <p className="text-sm font-bold text-[var(--store-primary)]">{formatCurrency(price)}</p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
