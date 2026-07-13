'use client'

import { Package, Tags } from 'lucide-react'

interface Props {
  productCount:  number
  categoryCount: number
}

export function StoreInfoBar({ productCount, categoryCount }: Props) {
  return (
    <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2">
        <Package size={16} className="text-primary" />
        <div>
          <p className="text-sm font-bold text-text-primary dark:text-stone-100">{productCount}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">Produtos</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Tags size={16} className="text-primary" />
        <div>
          <p className="text-sm font-bold text-text-primary dark:text-stone-100">{categoryCount}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">Categorias</p>
        </div>
      </div>
    </div>
  )
}
