'use client'

import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'
import { Plus, X, Loader2, AlertCircle, Copy, ClipboardCopy, Trash2, Sparkles, Upload, Image as ImageIcon } from 'lucide-react'
import { comboKey, type GroupRow } from '@/lib/catalog/variationCombos'
import { compressImage } from '@/lib/catalog/useImageCompression'
import { uploadImageXhr } from '@/lib/catalog/useImageUploadXhr'
import { VariationRulesWizard } from './VariationRulesWizard'

const IMAGE_MAX_PHOTOS = 4
const IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

const SETTINGS_FIELDS = ['price', 'stock_quantity', 'sku', 'lead_time_days', 'weight_kg', 'image_id'] as const

/**
 * Editor de variações (Papel, Gramatura, Impressão, Acabamento...). Grupos e
 * opções são livres; combinações (product_variants) NUNCA são geradas ou
 * apagadas automaticamente — a pessoa escolhe exatamente quais existem via
 * o assistente "Gerenciar combinações" (com regras de dependência entre
 * opções), "+ Nova combinação" manual, "Duplicar" ou "Copiar configuração".
 */
export function VariationsEditor({ productId, companyId }: Props) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [newGroupName, setNewGroupName] = useState('')
  const [newOptionByGroup, setNewOptionByGroup] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [variantForm, setVariantForm] = useState<{ selection: Record<string, string>; settings: Record<string, string> } | null>(null)
  const [copySourceId, setCopySourceId] = useState<string | null>(null)
  const [copyTargetId, setCopyTargetId] = useState<string>('')
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

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

  const existingCombos = useMemo(() => new Set(variantsNormalized.map(v => comboKey(v.optionIds))), [variantsNormalized])

  function invalidateVariants() {
    qc.invalidateQueries({ queryKey: ['product-variants', productId] })
  }
  function invalidateGroups() {
    qc.invalidateQueries({ queryKey: ['product-variation-groups', productId] })
  }

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
    onSuccess: () => { invalidateGroups(); invalidateVariants() },
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
    onSuccess: () => { invalidateGroups(); invalidateVariants() },
  })

  const updateVariantMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error: err } = await (supabase.from('product_variants') as any).update(patch).eq('id', id)
      if (err) throw err
    },
    onSuccess: invalidateVariants,
  })

  const deleteVariantMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await (supabase.from('product_variants') as any).delete().eq('id', id)
      if (err) throw err
    },
    onSuccess: invalidateVariants,
  })

  /** Insere uma combinação a partir de uma seleção {groupId: optionId} + configurações opcionais. */
  const createVariantMutation = useMutation({
    mutationFn: async ({ selection, settings }: { selection: Record<string, string>; settings: Record<string, string> }) => {
      const patch: Record<string, unknown> = {}
      if (settings.price !== '') patch.price = Number(settings.price)
      if (settings.stock_quantity !== '') patch.stock_quantity = Number(settings.stock_quantity)
      if (settings.sku !== '') patch.sku = settings.sku
      if (settings.lead_time_days !== '') patch.lead_time_days = Number(settings.lead_time_days)
      if (settings.weight_kg !== '') patch.weight_kg = Number(settings.weight_kg)
      if (settings.image_id !== '') patch.image_id = settings.image_id

      const { data: newVariant, error: insErr } = await (supabase.from('product_variants') as any)
        .insert({ product_id: productId, company_id: companyId, ...patch })
        .select('id').single()
      if (insErr) throw insErr

      const rows = groupsSorted.map(g => ({ variant_id: newVariant.id, option_id: selection[g.id], group_id: g.id }))
      const { error: valErr } = await (supabase.from('product_variant_option_values') as any).insert(rows)
      if (valErr) throw valErr
    },
    onSuccess: () => { invalidateVariants(); setVariantForm(null); setConfirmDuplicate(false); setError(null) },
    onError: (err: Error) => setError(err.message),
  })

  /** Gera em lote as combinações escolhidas pelo assistente — nunca apaga as existentes. */
  const bulkGenerateMutation = useMutation({
    mutationFn: async (combos: string[][]) => {
      for (const combo of combos) {
        const { data: newVariant, error: insErr } = await (supabase.from('product_variants') as any)
          .insert({ product_id: productId, company_id: companyId })
          .select('id').single()
        if (insErr) throw insErr
        const rows = combo.map((optionId, idx) => ({
          variant_id: newVariant.id, option_id: optionId, group_id: groupsSorted[idx].id,
        }))
        await (supabase.from('product_variant_option_values') as any).insert(rows)
      }
    },
    onSuccess: () => { invalidateVariants(); setShowWizard(false) },
  })

  const copyConfigMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      const source = variantsNormalized.find(v => v.id === sourceId)
      if (!source) return
      const patch: Record<string, unknown> = {}
      for (const f of SETTINGS_FIELDS) patch[f] = (source as any)[f]
      const { error: err } = await (supabase.from('product_variants') as any).update(patch).eq('id', targetId)
      if (err) throw err
    },
    onSuccess: () => { invalidateVariants(); setCopySourceId(null); setCopyTargetId('') },
  })

  /** Envia uma nova foto do produto (reaproveitada por qualquer combinação) e já a seleciona no formulário aberto. */
  const uploadVariantImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressImage(file)
      const url = await uploadImageXhr(compressed, { context: 'product', productId }, setImageUploadProgress)
      const nextOrder = productImages.length > 0 ? Math.max(...productImages.map(i => i.sort_order)) + 1 : 0
      const { data, error: err } = await (supabase.from('product_images') as any)
        .insert({ product_id: productId, company_id: companyId, url, sort_order: nextOrder })
        .select('id').single()
      if (err) throw err
      return data.id as string
    },
    onSuccess: (newImageId) => {
      qc.invalidateQueries({ queryKey: ['product-images', productId] })
      setImageUploadProgress(null)
      setImageUploadError(null)
      setVariantForm(f => f && ({ ...f, settings: { ...f.settings, image_id: newImageId } }))
    },
    onError: (err: Error) => { setImageUploadProgress(null); setImageUploadError(err.message) },
  })

  function handleImageFilePicked(file: File | undefined) {
    if (!file) return
    setImageUploadError(null)
    if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
      setImageUploadError('Formato não permitido. Use JPG, PNG ou WEBP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError('Arquivo muito grande. Máximo 10MB.')
      return
    }
    uploadVariantImageMutation.mutate(file)
  }

  function numOrNull(v: string): number | null {
    return v === '' ? null : Number(v)
  }

  function optionValue(groupId: string, optionId?: string): string {
    const g = groupsSorted.find(g => g.id === groupId)
    return g?.options.find(o => o.id === optionId)?.value ?? '—'
  }

  async function confirmRemoveOption(id: string) {
    const { count } = await (supabase.from('product_variant_option_values') as any)
      .select('variant_id', { count: 'exact', head: true }).eq('option_id', id)
    const msg = count && count > 0
      ? `Esta opção é usada em ${count} combinação(ões) já cadastrada(s). Excluí-la também excluirá essas combinações. Deseja continuar?`
      : 'Excluir esta opção?'
    if (confirm(msg)) removeOptionMutation.mutate(id)
  }

  async function confirmRemoveGroup(id: string) {
    const group = groupsSorted.find(g => g.id === id)
    const optionIds = group?.options.map(o => o.id) ?? []
    let count = 0
    if (optionIds.length > 0) {
      const res = await (supabase.from('product_variant_option_values') as any)
        .select('variant_id', { count: 'exact', head: true }).in('option_id', optionIds)
      count = res.count ?? 0
    }
    const msg = count > 0
      ? `Este grupo é usado em ${count} combinação(ões) já cadastrada(s). Removê-lo também excluirá essas combinações. Deseja continuar?`
      : 'Remover este grupo?'
    if (confirm(msg)) removeGroupMutation.mutate(id)
  }

  function closeVariantForm() {
    setVariantForm(null)
    setConfirmDuplicate(false)
    setError(null)
  }

  function openNewVariantForm() {
    setConfirmDuplicate(false)
    setVariantForm({
      selection: Object.fromEntries(groupsSorted.map(g => [g.id, g.options[0]?.id ?? ''])),
      settings: { price: '', stock_quantity: '', sku: '', lead_time_days: '', weight_kg: '', image_id: '' },
    })
  }

  function openDuplicateForm(v: VariantRow) {
    setConfirmDuplicate(false)
    setVariantForm({
      selection: Object.fromEntries(groupsSorted.map((g, idx) => [g.id, v.optionIds[idx] ?? g.options[0]?.id ?? ''])),
      settings: {
        price: v.price?.toString() ?? '', stock_quantity: v.stock_quantity?.toString() ?? '',
        sku: v.sku ?? '', lead_time_days: v.lead_time_days?.toString() ?? '',
        weight_kg: v.weight_kg?.toString() ?? '', image_id: v.image_id ?? '',
      },
    })
  }

  function submitVariantForm() {
    if (!variantForm) return
    if (groupsSorted.some(g => !variantForm.selection[g.id])) {
      setError('Selecione uma opção para cada grupo.')
      return
    }
    const optionIds = groupsSorted.map(g => variantForm.selection[g.id])
    if (existingCombos.has(comboKey(optionIds))) {
      // Nunca bloqueia — combinações "iguais" na seleção de opções podem ter
      // preço/condição diferentes de propósito (promoção, cliente específico
      // etc.), então só confirma antes de criar mesmo assim.
      setConfirmDuplicate(true)
      return
    }
    createVariantMutation.mutate(variantForm)
  }

  function forceSubmitVariantForm() {
    if (!variantForm) return
    setConfirmDuplicate(false)
    createVariantMutation.mutate(variantForm)
  }

  const busy = createVariantMutation.isPending || bulkGenerateMutation.isPending

  return (
    <div className="space-y-4">
      {/* Grupos + opções */}
      <div className="space-y-3">
        {groupsSorted.map(group => (
          <div key={group.id} className="rounded-xl border border-border dark:border-border-dark p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-primary dark:text-stone-100">{group.name}</span>
              <button type="button" onClick={() => confirmRemoveGroup(group.id)}
                className="text-[11px] text-error hover:underline">Remover grupo</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {group.options.map(opt => (
                <span key={opt.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary-50 dark:bg-primary/10 text-primary">
                  {opt.value}
                  <button type="button" onClick={() => confirmRemoveOption(opt.id)} className="hover:text-error">
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
            placeholder="Nome do grupo (ex: Papel, Gramatura, Impressão)"
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

      {/* Ações de combinação */}
      {groupsSorted.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowWizard(true)}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
            <Sparkles size={13} /> Gerenciar combinações
          </button>
          <button type="button" onClick={openNewVariantForm}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
            <Plus size={13} /> Nova combinação
          </button>
        </div>
      )}

      {/* Tabela de combinações existentes */}
      {groupsSorted.length === 0 ? (
        <p className="text-xs text-text-muted dark:text-stone-500 text-center py-2">
          Adicione um grupo de variação para começar a criar combinações.
        </p>
      ) : variantsNormalized.length === 0 ? (
        <p className="text-xs text-text-muted dark:text-stone-500 text-center py-2">
          Nenhuma combinação cadastrada ainda. Use &ldquo;Gerenciar combinações&rdquo; ou &ldquo;Nova combinação&rdquo; acima.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="border-b border-border dark:border-border-dark">
                {groupsSorted.map(g => (
                  <th key={g.id} className="text-left font-semibold text-text-muted uppercase tracking-wider p-2">{g.name}</th>
                ))}
                {['Preço', 'Estoque', 'SKU', 'Prazo (dias)', 'Peso (kg)', 'Imagem', 'Ações'].map(h => (
                  <th key={h} className="text-left font-semibold text-text-muted uppercase tracking-wider p-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variantsNormalized.map(v => (
                <tr key={v.id} className="border-b border-border dark:border-border-dark last:border-0">
                  {groupsSorted.map((g, idx) => (
                    <td key={g.id} className="p-2 text-text-primary dark:text-stone-200">{optionValue(g.id, v.optionIds[idx])}</td>
                  ))}
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
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <button type="button" title="Duplicar combinação" onClick={() => openDuplicateForm(v)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5">
                        <Copy size={13} />
                      </button>
                      <button type="button" title="Copiar configuração para outra combinação" onClick={() => setCopySourceId(v.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5">
                        <ClipboardCopy size={13} />
                      </button>
                      <button type="button" title="Excluir combinação"
                        onClick={() => { if (confirm('Excluir esta combinação?')) deleteVariantMutation.mutate(v.id) }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light dark:hover:bg-error/10">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assistente de dependência */}
      {showWizard && (
        <VariationRulesWizard
          productId={productId}
          companyId={companyId}
          groups={groupsSorted}
          existingCombos={existingCombos}
          onClose={() => setShowWizard(false)}
          onGenerate={combos => bulkGenerateMutation.mutateAsync(combos)}
          onOpenManualForm={() => { setShowWizard(false); openNewVariantForm() }}
        />
      )}

      {/* Formulário de combinação manual / duplicar */}
      {variantForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => closeVariantForm()} />
          <div
            className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal flex flex-col overflow-hidden"
            style={{ width: 'min(900px, 95vw)', maxHeight: '90vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border dark:border-border-dark flex-shrink-0">
              <h2 className="text-base font-semibold text-text-primary dark:text-stone-100">Nova combinação</h2>
              <button onClick={() => closeVariantForm()} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Body — só esta área rola */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Dados principais */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400">Dados principais</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {groupsSorted.map(g => (
                    <div key={g.id}>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">{g.name}</label>
                      <select
                        value={variantForm.selection[g.id] ?? ''}
                        onChange={e => setVariantForm(f => f && ({ ...f, selection: { ...f.selection, [g.id]: e.target.value } }))}
                        className="input w-full"
                      >
                        {g.options.map(o => <option key={o.id} value={o.id}>{o.value}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </section>

              <div className="h-px bg-border dark:bg-border-dark" />

              {/* Comercial */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400">Comercial</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Preço</label>
                    <input type="number" step="0.01" placeholder="Padrão" value={variantForm.settings.price}
                      onChange={e => setVariantForm(f => f && ({ ...f, settings: { ...f.settings, price: e.target.value } }))}
                      className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Estoque</label>
                    <input type="number" step="1" placeholder="Ilimitado" value={variantForm.settings.stock_quantity}
                      onChange={e => setVariantForm(f => f && ({ ...f, settings: { ...f.settings, stock_quantity: e.target.value } }))}
                      className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">SKU</label>
                    <input type="text" value={variantForm.settings.sku}
                      onChange={e => setVariantForm(f => f && ({ ...f, settings: { ...f.settings, sku: e.target.value } }))}
                      className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Prazo (dias)</label>
                    <input type="number" step="1" placeholder="Padrão" value={variantForm.settings.lead_time_days}
                      onChange={e => setVariantForm(f => f && ({ ...f, settings: { ...f.settings, lead_time_days: e.target.value } }))}
                      className="input w-full" />
                  </div>
                </div>
              </section>

              <div className="h-px bg-border dark:bg-border-dark" />

              {/* Logística */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400">Logística</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Peso (kg)</label>
                    <input type="number" step="0.001" placeholder="0,000" value={variantForm.settings.weight_kg}
                      onChange={e => setVariantForm(f => f && ({ ...f, settings: { ...f.settings, weight_kg: e.target.value } }))}
                      className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Imagem da combinação</label>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={e => { handleImageFilePicked(e.target.files?.[0]); e.target.value = '' }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setVariantForm(f => f && ({ ...f, settings: { ...f.settings, image_id: '' } }))}
                        className={clsx(
                          'flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl border-2 text-[10px] font-medium transition-colors flex-shrink-0',
                          !variantForm.settings.image_id
                            ? 'border-primary text-primary bg-primary-50 dark:bg-primary/10'
                            : 'border-border dark:border-border-dark text-text-muted hover:border-primary/40'
                        )}
                      >
                        <ImageIcon size={16} /> Padrão
                      </button>
                      {productImages.map((img, i) => {
                        const active = variantForm.settings.image_id === img.id
                        return (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setVariantForm(f => f && ({ ...f, settings: { ...f.settings, image_id: img.id } }))}
                            className={clsx(
                              'relative w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-colors',
                              active ? 'border-primary' : 'border-transparent hover:border-primary/40'
                            )}
                            title={`Foto ${i + 1}`}
                          >
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        disabled={productImages.length >= IMAGE_MAX_PHOTOS || uploadVariantImageMutation.isPending}
                        onClick={() => imageInputRef.current?.click()}
                        title={productImages.length >= IMAGE_MAX_PHOTOS ? 'Limite de 4 fotos do produto atingido' : 'Enviar imagem'}
                        className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl border-2 border-dashed border-border dark:border-border-dark text-text-muted hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {uploadVariantImageMutation.isPending
                          ? <Loader2 size={16} className="animate-spin" />
                          : <Upload size={16} />}
                        <span className="text-[10px] font-medium">Enviar</span>
                      </button>
                    </div>
                    {imageUploadProgress !== null && (
                      <p className="flex items-center gap-1.5 text-[11px] text-text-muted mt-2">
                        <Loader2 size={11} className="animate-spin" /> Enviando... {imageUploadProgress}%
                      </p>
                    )}
                    {imageUploadError && (
                      <p className="flex items-center gap-1 text-[11px] text-error dark:text-red-400 mt-2">
                        <AlertCircle size={11} /> {imageUploadError}
                      </p>
                    )}
                    <p className="text-[11px] text-text-muted dark:text-stone-500 mt-2">
                      Arraste uma imagem para a área de upload ou clique em Enviar. Até {IMAGE_MAX_PHOTOS} fotos por produto,
                      compartilhadas entre as combinações.
                    </p>
                  </div>
                </div>
              </section>

              {error && (
                <p className="flex items-center gap-1 text-xs text-error dark:text-red-400">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
            </div>

            {/* Footer — sempre fixo, nunca rola */}
            <div className="flex gap-3 p-5 sm:p-6 border-t border-border dark:border-border-dark flex-shrink-0">
              <button type="button" onClick={() => closeVariantForm()} className="btn-secondary flex-1">Cancelar</button>
              <button type="button" disabled={busy} onClick={submitVariantForm}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {busy && <Loader2 size={14} className="animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar criação de combinação duplicada */}
      {confirmDuplicate && variantForm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDuplicate(false)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-5">
            <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-2">Já existe uma combinação idêntica</h2>
            <p className="text-xs text-text-muted dark:text-stone-500 mb-4">
              Já existe uma combinação com exatamente essas opções ({groupsSorted.map(g => optionValue(g.id, variantForm.selection[g.id])).join(' · ')}).
              Deseja criar mesmo assim? Útil para promoções, preços especiais ou versões exclusivas.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDuplicate(false)} className="btn-secondary flex-1 text-sm py-2">
                Cancelar
              </button>
              <button type="button" disabled={busy} onClick={forceSubmitVariantForm}
                className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5 disabled:opacity-50">
                {busy && <Loader2 size={13} className="animate-spin" />} Criar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copiar configuração */}
      {copySourceId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCopySourceId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-4">
            <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">Copiar configuração para...</h2>
            <select value={copyTargetId} onChange={e => setCopyTargetId(e.target.value)} className="input text-xs h-9 w-full mb-3">
              <option value="">Selecione a combinação de destino</option>
              {variantsNormalized.filter(v => v.id !== copySourceId).map(v => (
                <option key={v.id} value={v.id}>
                  {groupsSorted.map((g, idx) => optionValue(g.id, v.optionIds[idx])).join(' · ')}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCopySourceId(null)} className="btn-secondary flex-1 text-xs py-2">Cancelar</button>
              <button
                type="button"
                disabled={!copyTargetId || copyConfigMutation.isPending}
                onClick={() => copyConfigMutation.mutate({ sourceId: copySourceId, targetId: copyTargetId })}
                className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {copyConfigMutation.isPending && <Loader2 size={12} className="animate-spin" />} Copiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
