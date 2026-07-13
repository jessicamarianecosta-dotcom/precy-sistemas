'use client'

import { ShieldCheck, Zap, Package, Tags } from 'lucide-react'
import type { StorefrontSettings } from './types'

interface Props {
  settings:      StorefrontSettings
  productCount:  number
  categoryCount: number
}

export function StoreInfoBar({ settings, productCount, categoryCount }: Props) {
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

      <div className="flex-1" />

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success-light text-success-dark">
          <ShieldCheck size={12} /> Loja Verificada
        </span>
        {settings.whatsapp && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-50 dark:bg-primary/10 text-primary">
            <Zap size={12} /> Responde rápido
          </span>
        )}
      </div>
    </div>
  )
}
