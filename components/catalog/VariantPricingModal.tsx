'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { calcVariantPricing } from '@/lib/produtos/variantPricing'

export interface VariantPricingValues {
  material_cost: number | null
  labor_cost: number | null
  extra_cost: number | null
  markup_percentage: number | null
  price: number | null
}

interface Props {
  title: string
  initial: VariantPricingValues
  /** Preço/custo do produto, mostrados como referência do fallback. */
  productPrice: number
  productMarkup: number
  saving?: boolean
  onSave: (v: VariantPricingValues & { total_cost: number }) => void
  onClose: () => void
}

const toStr = (n: number | null | undefined) => (n == null ? '' : String(n))

/**
 * Precificação de uma combinação — mesma estrutura do produto (material +
 * mão de obra + extras, com margem sobre o custo). O preço sugerido é
 * calculado; a pessoa pode ajustá-lo manualmente.
 */
export function VariantPricingModal({ title, initial, productPrice, productMarkup, saving, onSave, onClose }: Props) {
  const [f, setF] = useState({
    material: toStr(initial.material_cost), labor: toStr(initial.labor_cost), extra: toStr(initial.extra_cost),
    markup: initial.markup_percentage != null ? String(initial.markup_percentage) : String(productMarkup || ''),
    price: toStr(initial.price), priceTouched: initial.price != null,
  })
  const [err, setErr] = useState<string | null>(null)

  const calc = calcVariantPricing({
    material_cost: Number(f.material) || 0, labor_cost: Number(f.labor) || 0,
    extra_cost: Number(f.extra) || 0, markup_percentage: Number(f.markup) || 0,
  })
  const price = f.priceTouched && f.price !== '' ? Number(f.price) : calc.price
  const profit = Math.round((price - calc.totalCost) * 100) / 100

  function submit() {
    const nums = [f.material, f.labor, f.extra, f.markup, f.price].filter(x => x !== '').map(Number)
    if (nums.some(n => !Number.isFinite(n) || n < 0)) return setErr('Use apenas valores válidos e não negativos.')
    if (!(price > 0)) return setErr('Informe custos e margem (ou um preço) maiores que zero.')
    setErr(null)
    onSave({
      material_cost: f.material === '' ? null : Number(f.material),
      labor_cost: f.labor === '' ? null : Number(f.labor),
      extra_cost: f.extra === '' ? null : Number(f.extra),
      markup_percentage: f.markup === '' ? null : Number(f.markup),
      price, total_cost: calc.totalCost,
    })
  }

  const field = (label: string, key: 'material' | 'labor' | 'extra' | 'markup', step = '0.01') => (
    <label className="block">
      <span className="text-xs font-medium text-text-secondary dark:text-stone-300">{label}</span>
      <input type="number" min="0" step={step} className="input mt-1" value={f[key]}
        onChange={e => setF(s => ({ ...s, [key]: e.target.value, ...(s.priceTouched ? {} : { price: '' }) }))} />
    </label>
  )

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-stone-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border dark:border-stone-800">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Precificação da combinação</p>
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100 break-words">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-primary"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field('Material (R$)', 'material')}
            {field('Mão de obra / impressão (R$)', 'labor')}
            {field('Custos adicionais (R$)', 'extra')}
            {field('Margem (%)', 'markup', '1')}
          </div>
          <label className="block">
            <span className="text-xs font-medium text-text-secondary dark:text-stone-300">Preço de venda (R$) — calculado, ajustável</span>
            <input type="number" min="0" step="0.01" className="input mt-1"
              value={f.priceTouched ? f.price : (calc.price ? String(calc.price) : '')}
              onChange={e => setF(s => ({ ...s, price: e.target.value, priceTouched: e.target.value !== '' }))} />
          </label>
          <div className="rounded-xl border border-border dark:border-stone-700 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Custo total</span><span>{formatCurrency(calc.totalCost)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Preço</span><span className="font-bold text-primary">{formatCurrency(price)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Lucro</span><span className={profit >= 0 ? 'font-semibold text-success' : 'font-semibold text-error'}>{formatCurrency(profit)}</span></div>
          </div>
          <p className="text-[10px] text-text-muted">Sem precificação própria, a combinação usa o preço do produto ({formatCurrency(productPrice)}).</p>
          {err && <p className="text-xs text-error">{err}</p>}
        </div>
        <div className="p-4 border-t border-border dark:border-stone-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancelar</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-50">
            {saving && <Loader2 size={13} className="animate-spin" />} Salvar precificação
          </button>
        </div>
      </div>
    </div>
  )
}
