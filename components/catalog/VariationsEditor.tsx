'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, AlertCircle } from 'lucide-react'

interface OptionRow { id: string; group_id: string; value: string; sort_order: number }
interface GroupRow { id: string; name: string; sort_order: number; options: OptionRow[] }
interface VariantRow {
  id: string
  sku: string | null
  price: number | null
  stock_quantity: number | null
  lead_time_days: number | null
  weight_kg: number | null
  image_id: string | null
  optionIds: string[]
}
interface ProductImage { id: string; url: string; sort_order: number }

interface Props {
  productId: string
  companyId: string
}

function comboKey(optionIds: string[]) { return optionIds.join('|') }

function cartesian(groups: GroupRow[]): string[][] {
  if (groups.length === 0 || groups.some(g => g.options.length === 0)) return []
  return groups.reduce<string[][]>((acc, g) => {
    if (acc.length === 0) return g.options.map(o => [o.id])
    const next: string[][] = []
    for (const combo of acc) for (const o of g.options) next.push([...combo, o.id])
    return next
  }, [])
}

/**
 * Editor de variações (Cor, Tamanho, Quantidade...): o lojista cria grupos
 * e opções livremente; o sistema gera automaticamente todas as combinações
 * como linhas em product_variants (mantendo dados já editados de combos que
 * continuam existindo, removendo os que não existem mais).
 */
export function VariationsEditor({ productId, companyId }: Props) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [newGroupName, setNewGroupName] = useState('')
  const [newOptionByGroup, setNewOptionByGroup] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const groupsQuery = useQuery<GroupRow[]>({
    queryKey: ['product-variation-groups', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await (supabase.from('product_variation_groups') as any)
        .select('id, name, sort_order, product_variation_options(id, group_id, value, sort_order)')
        .eq('product_id', productId)
        .order('sort_order')
        .order('sort_order', { foreignTable: 'product_variation_options' })
      return (data ?? []).map((g: any) => ({
        id: g.id, name: g.name, sort_order: g.sort_order,
        options: g.product_variation_options ?? [],
      }))
    },
  })

  const variantsQuery = useQuery<any[]>({
    queryKey: ['product-variants', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await (supabase.from('product_variants') as any)
        .select('id, sku, price, stock_quantity, lead_time_days, weight_kg, image_id, sort_order, product_variant_option_values(option_id, group_id)')
        .eq('product_id', productId)
        .order('sort_order')
      return data ?? []
    },
  })

  const imagesQuery = useQuery<ProductImage[]>({
    queryKey: ['product-images', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await (supabase.from('product_images') as any)
        .select('id, url, sort_order').eq('product_id', productId).order('sort_order')
      return data ?? []
    },
  })

  const groupsSorted = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const productImages = imagesQuery.data ?? []

  const variantsNormalized = useMemo<VariantRow[]>(() => {
    return (variantsQuery.data ?? []).map(v => {
      const byGroup = new Map<string, string>((v.product_variant_option_values ?? []).map((ov: any) => [ov.group_id, ov.option_id]))
      const optionIds = groupsSorted.map(g => byGroup.get(g.id)).filter((x): x is string => !!x)
      return {
        id: v.id, sku: v.sku, price: v.price, stock_quantity: v.stock_quantity,
        lead_time_days: v.lead_time_days, weight_kg: v.weight_kg, image_id: v.image_id,
        optionIds,
      }
    })
  }, [variantsQuery.data, groupsSorted])

  function invalidateVariants() {
    qc.invalidateQueries({ queryKey: ['product-variants', productId] })
  }
  function invalidateGroups() {
    qc.invalidateQueries({ queryKey: ['product-variation-groups', productId] })
  }

  const syncMutation = useMutation({
    mutationFn: async ({ toInsert, toDelete }: { toInsert: string[][]; toDelete: string[] }) => {
      if (toDelete.length > 0) {
        await (supabase.from('product_variants') as any).delete().in('id', toDelete)
      }
      for (const combo of toInsert) {
        const { data: newVariant, error: insErr } = await (supabase.from('product_variants') as any)
          .insert({ product_id: productId, company_id: companyId })
          .select('id').single()
        if (insErr) throw insErr
        const rows = combo.map((optionId, idx) => ({
          variant_id: newVariant.id,
          option_id: optionId,
          group_id: groupsSorted[idx].id,
        }))
        await (supabase.from('product_variant_option_values') as any).insert(rows)
      }
    },
    onSuccess: invalidateVariants,
  })

  // Gera/remove combinações automaticamente sempre que grupos/opções mudam.
  useEffect(() => {
    if (syncMutation.isPending) return
    const combos = cartesian(groupsSorted)
    const comboKeys = new Set(combos.map(comboKey))
    const existingKeys = new Set(variantsNormalized.map(v => comboKey(v.optionIds)))
    const toInsert = combos.filter(c => !existingKeys.has(comboKey(c)))
    const toDelete = variantsNormalized.filter(v => !comboKeys.has(comboKey(v.optionIds))).map(v => v.id)
    if (toInsert.length > 0 || toDelete.length > 0) {
      syncMutation.mutate({ toInsert, toDelete })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsSorted, variantsNormalized])

  const addGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error: err } = await (supabase.from('product_variation_groups') as any)
        .insert({ product_id: productId, company_id: companyId, name, sort_order: groupsSorted.length })
      if (err) throw err
    },
    onSuccess: () => { invalidateGroups(); setNewGroupName(''); setError(null) },
    onError: (err: Error) => setError(err.message),
  })

  const removeGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await (supabase.from('product_variation_groups') as any).delete().eq('id', id)
      if (err) throw err
    },
    onSuccess: invalidateGroups,
  })

  const addOptionMutation = useMutation({
    mutationFn: async ({ groupId, value }: { groupId: string; value: string }) => {
      const group = groupsSorted.find(g => g.id === groupId)
      const { error: err } = await (supabase.from('product_variation_options') as any)
        .insert({ group_id: groupId, company_id: companyId, value, sort_order: group?.options.length ?? 0 })
      if (err) throw err
    },
    onSuccess: (_d, vars) => {
      invalidateGroups()
      setNewOptionByGroup(prev => ({ ...prev, [vars.groupId]: '' }))
      setError(null)
    },
    onError: (err: Error) => setError(err.message.includes('duplicate') ? 'Essa opção já existe neste grupo.' : err.message),
  })

  const removeOptionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await (supabase.from('product_variation_options') as any).delete().eq('id', id)
      if (err) throw err
    },
    onSuccess: invalidateGroups,
  })

  const updateVariantMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error: err } = await (supabase.from('product_variants') as any).update(patch).eq('id', id)
      if (err) throw err
    },
    onSuccess: invalidateVariants,
  })

  function numOrNull(v: string): number | null {
    return v === '' ? null : Number(v)
  }

  const syncing = syncMutation.isPending
  const fullVariants = variantsNormalized.filter(v => v.optionIds.length === groupsSorted.length)

  return (
    <div className="space-y-4">
      {/* Grupos + opções */}
      <div className="space-y-3">
        {groupsSorted.map(group => (
          <div key={group.id} className="rounded-xl border border-border dark:border-border-dark p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-primary dark:text-stone-100">{group.name}</span>
              <button type="button" onClick={() => removeGroupMutation.mutate(group.id)}
                className="text-[11px] text-error hover:underline">Remover grupo</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {group.options.map(opt => (
                <span key={opt.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary-50 dark:bg-primary/10 text-primary">
                  {opt.value}
                  <button type="button" onClick={() => removeOptionMutation.mutate(opt.id)} className="hover:text-error">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <form
              onSubmit={e => {
                e.preventDefault()
                const value = (newOptionByGroup[group.id] ?? '').trim()
                if (value) addOptionMutation.mutate({ groupId: group.id, value })
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newOptionByGroup[group.id] ?? ''}
                onChange={e => setNewOptionByGroup(prev => ({ ...prev, [group.id]: e.target.value }))}
                placeholder="Nova opção (ex: Branco)"
                className="input text-xs h-8 flex-1"
              />
              <button type="submit" className="btn-secondary text-xs h-8 px-2.5 flex items-center gap-1">
                <Plus size={12} /> Adicionar
              </button>
            </form>
          </div>
        ))}

        <form
          onSubmit={e => { e.preventDefault(); const name = newGroupName.trim(); if (name) addGroupMutation.mutate(name) }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="Nome do grupo (ex: Cor, Tamanho, Quantidade)"
            className="input text-xs h-9 flex-1"
          />
          <button type="submit" className="btn-primary text-xs h-9 px-3 flex items-center gap-1.5 flex-shrink-0">
            <Plus size={13} /> Adicionar grupo
          </button>
        </form>

        {error && (
          <p className="flex items-center gap-1 text-[11px] text-error dark:text-red-400">
            <AlertCircle size={11} /> {error}
          </p>
        )}
      </div>

      {/* Tabela de variantes geradas */}
      {groupsSorted.length === 0 ? (
        <p className="text-xs text-text-muted dark:text-stone-500 text-center py-2">
          Adicione um grupo de variação para gerar as combinações automaticamente.
        </p>
      ) : syncing ? (
        <div className="flex items-center gap-2 text-xs text-text-muted py-3">
          <Loader2 size={13} className="animate-spin" /> Gerando combinações...
        </div>
      ) : fullVariants.length === 0 ? (
        <p className="text-xs text-text-muted dark:text-stone-500 text-center py-2">
          Adicione ao menos uma opção em cada grupo para gerar as variações.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-border dark:border-border-dark">
                {groupsSorted.map(g => (
                  <th key={g.id} className="text-left font-semibold text-text-muted uppercase tracking-wider p-2">{g.name}</th>
                ))}
                {['Preço', 'Estoque', 'SKU', 'Prazo (dias)', 'Peso (kg)', 'Imagem'].map(h => (
                  <th key={h} className="text-left font-semibold text-text-muted uppercase tracking-wider p-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fullVariants.map(v => (
                <tr key={v.id} className="border-b border-border dark:border-border-dark last:border-0">
                  {v.optionIds.map((optId, idx) => {
                    const opt = groupsSorted[idx]?.options.find(o => o.id === optId)
                    return <td key={optId} className="p-2 text-text-primary dark:text-stone-200">{opt?.value ?? '—'}</td>
                  })}
                  <td className="p-2">
                    <input type="number" step="0.01" defaultValue={v.price ?? ''} placeholder="Padrão"
                      onBlur={e => updateVariantMutation.mutate({ id: v.id, patch: { price: numOrNull(e.target.value) } })}
                      className="input text-xs h-7 w-20" />
                  </td>
                  <td className="p-2">
                    <input type="number" step="1" defaultValue={v.stock_quantity ?? ''} placeholder="Ilimitado"
                      onBlur={e => updateVariantMutation.mutate({ id: v.id, patch: { stock_quantity: numOrNull(e.target.value) } })}
                      className="input text-xs h-7 w-20" />
                  </td>
                  <td className="p-2">
                    <input type="text" defaultValue={v.sku ?? ''}
                      onBlur={e => updateVariantMutation.mutate({ id: v.id, patch: { sku: e.target.value || null } })}
                      className="input text-xs h-7 w-24" />
                  </td>
                  <td className="p-2">
                    <input type="number" step="1" defaultValue={v.lead_time_days ?? ''} placeholder="Padrão"
                      onBlur={e => updateVariantMutation.mutate({ id: v.id, patch: { lead_time_days: numOrNull(e.target.value) } })}
                      className="input text-xs h-7 w-16" />
                  </td>
                  <td className="p-2">
                    <input type="number" step="0.001" defaultValue={v.weight_kg ?? ''}
                      onBlur={e => updateVariantMutation.mutate({ id: v.id, patch: { weight_kg: numOrNull(e.target.value) } })}
                      className="input text-xs h-7 w-16" />
                  </td>
                  <td className="p-2">
                    <select
                      defaultValue={v.image_id ?? ''}
                      onChange={e => updateVariantMutation.mutate({ id: v.id, patch: { image_id: e.target.value || null } })}
                      className="input text-xs h-7 w-24"
                    >
                      <option value="">Padrão</option>
                      {productImages.map((img, i) => (
                        <option key={img.id} value={img.id}>Foto {i + 1}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
