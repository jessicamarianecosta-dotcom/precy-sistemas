'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import {
  buildVariantLabel,
  resolveVariantPricing,
  type ProductPricingRecord,
  type ResolvedPricing,
  type VariantRecord,
} from '@/lib/produtos/variantPricing'

export interface VariantSelection {
  variantId: string
  label: string
  pricing: ResolvedPricing
}

interface Props {
  product: { id: string; name: string } & ProductPricingRecord
  onConfirm: (sel: VariantSelection) => void
  onClose: () => void
}

interface Group { id: string; name: string; options: { id: string; value: string }[] }
interface VariantFull extends VariantRecord { optionByGroup: Record<string, string> }

/**
 * Seletor de variação usado ao adicionar produto com variações a um
 * orçamento/pedido. Uma única consulta (grupos+opções+combinações ativas).
 * Só habilita opções que levam a uma combinação existente.
 */
export function VariantPickerModal({ product, onConfirm, onClose }: Props) {
  const supabase = createClient()
  const [selection, setSelection] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['variant-picker', product.id],
    staleTime: 30_000,
    queryFn: async () => {
      const [g, v] = await Promise.all([
        (supabase.from('product_variation_groups') as any)
          .select('id, name, sort_order, product_variation_options(id, value, sort_order)')
          .eq('product_id', product.id)
          .order('sort_order')
          .order('sort_order', { foreignTable: 'product_variation_options' }),
        (supabase.from('product_variants') as any)
          .select('id, price, stock_quantity, material_cost, labor_cost, extra_cost, total_cost, markup_percentage, is_active, sort_order, product_variant_option_values(option_id, group_id)')
          .eq('product_id', product.id)
          .eq('is_active', true)
          .order('sort_order'),
      ])
      const groups: Group[] = (g.data ?? []).map((x: any) => ({
        id: x.id, name: x.name, options: (x.product_variation_options ?? []).map((o: any) => ({ id: o.id, value: o.value })),
      })).filter((x: Group) => x.options.length > 0)
      const variants: VariantFull[] = (v.data ?? []).map((x: any) => ({
        id: x.id,
        price: x.price != null ? Number(x.price) : null,
        total_cost: x.total_cost != null ? Number(x.total_cost) : null,
        stock_quantity: x.stock_quantity,
        optionByGroup: Object.fromEntries((x.product_variant_option_values ?? []).map((ov: any) => [ov.group_id, ov.option_id])),
      }))
      return { groups, variants }
    },
  })

  const groups = useMemo(() => data?.groups ?? [], [data])
  const variants = useMemo(() => data?.variants ?? [], [data])

  // Se só existe uma combinação possível, já deixa pré-selecionada.
  useEffect(() => {
    if (variants.length === 1 && Object.keys(selection).length === 0) setSelection(variants[0].optionByGroup)
  }, [variants, selection])

  const optionEnabled = (groupId: string, optionId: string) =>
    variants.some(v => v.optionByGroup[groupId] === optionId &&
      Object.entries(selection).every(([gid, oid]) => gid === groupId || v.optionByGroup[gid] === oid))

  const matched = useMemo(() => {
    if (groups.length === 0 || groups.some(g => !selection[g.id])) return null
    return variants.find(v => groups.every(g => v.optionByGroup[g.id] === selection[g.id])) ?? null
  }, [groups, variants, selection])

  const pricing = matched ? resolveVariantPricing(matched, product) : null
  const label = buildVariantLabel(groups.map(g => g.options.find(o => o.id === selection[g.id])?.value ?? ''))
  const allChosen = groups.length > 0 && groups.every(g => selection[g.id])
  const outOfStock = matched?.stock_quantity != null && matched.stock_quantity <= 0

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-stone-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border dark:border-stone-800">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Escolha a variação</p>
            <p className="text-sm font-semibold text-text-primary dark:text-stone-100 break-words">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-primary"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading && <p className="text-xs text-text-muted text-center py-4">Carregando variações…</p>}
          {!isLoading && groups.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">Este produto não possui variações ativas.</p>
          )}
          {groups.map(g => (
            <div key={g.id}>
              <p className="text-xs font-semibold text-text-secondary dark:text-stone-300 mb-1.5">{g.name}</p>
              <div className="flex flex-wrap gap-2">
                {g.options.map(o => {
                  const active = selection[g.id] === o.id
                  const enabled = optionEnabled(g.id, o.id)
                  return (
                    <button key={o.id} type="button" disabled={!enabled && !active}
                      onClick={() => setSelection(s => active ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== g.id)) : { ...s, [g.id]: o.id })}
                      className={clsx('px-3.5 py-2.5 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg border text-sm sm:text-xs font-medium transition-colors',
                        active ? 'border-primary bg-primary-50 text-primary dark:bg-primary/10'
                          : enabled ? 'border-border dark:border-stone-700 hover:border-primary/50'
                            : 'border-border dark:border-stone-800 text-text-muted opacity-40 cursor-not-allowed')}>
                      {o.value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {allChosen && !matched && (
            <p className="flex items-center gap-1.5 text-xs text-error"><AlertCircle size={12} /> Combinação indisponível. Escolha outra.</p>
          )}
          {outOfStock && (
            <p className="flex items-center gap-1.5 text-xs text-warning-dark dark:text-warning"><AlertCircle size={12} /> Combinação sem estoque.</p>
          )}

          {pricing && (
            <div className="rounded-xl border border-border dark:border-stone-700 p-3 space-y-1 text-sm">
              <p className="text-xs text-text-muted">{label}</p>
              <div className="flex justify-between"><span className="text-text-muted">Preço</span><span className="font-bold text-primary">{formatCurrency(pricing.price)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Custo</span><span>{formatCurrency(pricing.cost)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Lucro</span>
                <span className={clsx('font-semibold', pricing.profit >= 0 ? 'text-success' : 'text-error')}>{formatCurrency(pricing.profit)}</span></div>
              {pricing.source === 'product' && (
                <p className="text-[10px] text-text-muted pt-1">Combinação sem precificação própria — usando preço/custo do produto.</p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border dark:border-stone-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancelar</button>
          <button type="button" disabled={!matched || !pricing || pricing.price <= 0}
            onClick={() => matched && pricing && onConfirm({ variantId: matched.id, label, pricing })}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
