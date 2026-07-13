'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Store } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import type { StorefrontProduct } from './types'

const NEW_THRESHOLD_DAYS = 14

interface Props {
  product:      StorefrontProduct
  href:         string
  isBestseller: boolean
}

export function ProductCard({ product, href, isBestseller }: Props) {
  const price = product.catalog_starting_price ?? product.final_price
  const hasPromo = product.catalog_promo_price != null && product.catalog_promo_price < price
  const photo = product.catalog_photos?.[0]

  const isNew = (Date.now() - new Date(product.created_at).getTime()) / 86400000 <= NEW_THRESHOLD_DAYS

  const badge = hasPromo ? { label: 'Promoção', className: 'bg-error text-white' }
    : isBestseller ? { label: 'Mais vendido', className: 'bg-amber-500 text-white' }
    : isNew ? { label: 'Novo', className: 'bg-primary text-white' }
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
            <img src={photo} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <Store size={32} className="text-text-muted" />
          )}
          {badge && (
            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-medium text-text-primary dark:text-stone-100 line-clamp-2 mb-1.5 min-h-[2.5em]">{product.name}</p>
          {hasPromo ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-error">{formatCurrency(product.catalog_promo_price!)}</span>
              <span className="text-xs text-text-muted line-through">{formatCurrency(price)}</span>
            </div>
          ) : (
            <p className="text-sm font-bold text-primary">{formatCurrency(price)}</p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
