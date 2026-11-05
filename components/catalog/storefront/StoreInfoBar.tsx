'use client'

import { Package, Tags } from 'lucide-react'

interface Props {
  productCount:  number
  categoryCount: number
}

export function StoreInfoBar({ productCount, categoryCount }: Props) {
  return (
    <div
      className="rounded-2xl border shadow-card p-4 flex flex-wrap items-center gap-x-6 gap-y-3"
      style={{ backgroundColor: 'var(--store-surface)', borderColor: 'var(--store-border)' }}
    >
      <div className="flex items-center gap-2">
        <Package size={16} style={{ color: 'var(--store-primary)' }} />
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--store-text)' }}>{productCount}</p>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--store-text-secondary)' }}>Produtos</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Tags size={16} style={{ color: 'var(--store-primary)' }} />
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--store-text)' }}>{categoryCount}</p>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--store-text-secondary)' }}>Categorias</p>
        </div>
      </div>
    </div>
  )
}
