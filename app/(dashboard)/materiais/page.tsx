'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  X,
  Loader2,
} from 'lucide-react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { clsx } from 'clsx'
import { formatCurrency } from '@/lib/utils/format'

/* ─────────────────────────────────────────────
   Materiais — CRUD de cadastro sobre a mesma tabela `inventory`
   usada pelo Estoque (decisão da Fase 2 do projeto Precy Essencial:
   não separar fisicamente a tabela para não quebrar Precificação,
   Produtos e Fornecedores, que já leem `inventory`).

   Diferença de responsabilidade entre as duas telas:
   - Materiais: cadastro do material em si — nome, categoria,
     unidade, custo por unidade, fornecedor, observações.
   - Estoque: quantidade em mão, estoque mínimo e status (saudável/
     atenção/crítico) dos MESMOS registros.

   Por isso aqui NÃO se edita quantidade/estoque mínimo: ao criar um
   material novo, quantidade e estoque mínimo ficam no padrão do
   banco (0) e quem ajusta depois é a tela de Estoque. Ao editar um
   material existente, o payload enviado nunca inclui esses dois
   campos, para não sobrescrever o que já foi ajustado no Estoque.
───────────────────────────────────────────── */

const schema = z.object({
  name:          z.string().min(2, 'Nome obrigatório'),
  category:      z.string().default('geral'),
  unit:          z.string().default('un'),
  cost_per_unit: z.coerce.number().min(0),
  supplier:      z.string().optional(),
  observations:  z.string().optional(),
})

type FormData = z.infer<typeof schema>

function fmt(v: number) {
  return formatCurrency(v)
}

const PRESET_CATEGORIES = [
  { value: 'papel',       label: 'Papel'       },
  { value: 'adesivo',     label: 'Adesivo'     },
  { value: 'tinta',       label: 'Tinta'       },
  { value: 'embalagem',   label: 'Embalagem'   },
  { value: 'tecido',      label: 'Tecido'      },
  { value: 'acrilico',    label: 'Acrílico'    },
  { value: 'vinil',       label: 'Vinil'       },
  { value: 'sublimacao',  label: 'Sublimação'  },
  { value: 'madeira',     label: 'Madeira'     },
  { value: 'mdf',         label: 'MDF'         },
  { value: 'metal',       label: 'Metal'       },
  { value: 'plastico',    label: 'Plástico'    },
  { value: 'transfer',    label: 'Transfer'    },
  { value: 'caneca',      label: 'Caneca'      },
  { value: 'camiseta',    label: 'Camiseta'    },
  { value: 'geral',       label: 'Geral'       },
  { value: 'outro',       label: 'Outro'       },
] as const

export default function MateriaisPage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { companyId } = useCompanyId()

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategories, setCustomCategories] = useState<string[]>([])

  /* ── Query — mesma chave ['inventory', companyId] usada pelo Estoque,
     para que uma alteração aqui invalide o cache de lá também (e
     vice-versa), já que é a mesma tabela. ── */
  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('inventory') as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      unit: 'un',
      cost_per_unit: 0,
      category: 'geral',
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (d: FormData) => {
      if (editingId) {
        // Edição: nunca inclui quantity/minimum_quantity — isso é
        // responsabilidade da tela de Estoque.
        const { error } = await (supabase.from('inventory') as any)
          .update({ ...d, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
      } else {
        // Criação: quantity/minimum_quantity ficam no default do
        // banco (0) — o material nasce sem estoque até alguém
        // lançar uma entrada na tela de Estoque.
        const { error } = await (supabase.from('inventory') as any)
          .insert([{ ...d, company_id: companyId! }])
          .select()
        if (error) throw error
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['inventory', companyId] })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })

      // Igual ao Estoque: alterar o material recalcula produtos
      // vinculados via trigger no banco.
      if (editingId) {
        qc.invalidateQueries({ queryKey: ['products', companyId] })
        qc.invalidateQueries({ queryKey: ['product-materials'] })
        toast('success', 'Material atualizado! Produtos vinculados recalculados automaticamente.')
      } else {
        toast('success', 'Material cadastrado! Ajuste a quantidade em Estoque quando chegar.')
      }

      const savedCat = variables.category
      if (
        savedCat &&
        !PRESET_CATEGORIES.some(c => c.value === savedCat) &&
        !customCategories.includes(savedCat)
      ) {
        setCustomCategories(prev => [...prev, savedCat])
      }

      closeModal()
    },
    onError: (err: Error) => {
      console.error('[materiais] save error:', err)
      toast('error', `Erro ao salvar: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase.from('inventory') as any)
        .delete()
        .eq('id', id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Nenhum material foi excluído — verifique se ele ainda existe ou se você tem permissão.')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', companyId] })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      toast('success', 'Material removido.')
      setDeleteId(null)
    },
    onError: (err: Error) => {
      console.error('[materiais] delete error:', err)
      toast('error', `Erro ao excluir: ${err.message}`)
    },
  })

  function openEdit(item: Record<string, any>) {
    setEditingId(item.id)

    const itemCategory = item.category || 'geral'
    const isPreset = PRESET_CATEGORIES.some(c => c.value === itemCategory)
    setIsCustomCategory(!isPreset)
    if (!isPreset && itemCategory && !customCategories.includes(itemCategory)) {
      setCustomCategories(prev => [...prev, itemCategory])
    }

    setValue('name', item.name || '')
    setValue('category', itemCategory)
    setValue('unit', item.unit || 'un')
    setValue('cost_per_unit', Number(item.cost_per_unit || 0))
    setValue('supplier', item.supplier || '')
    setValue('observations', item.observations || '')

    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    reset()
    setEditingId(null)
    setIsCustomCategory(false)
  }

  async function handleDuplicate(item: Record<string, any>) {
    if (!companyId) return
    try {
      const { data: newItem, error } = await (supabase.from('inventory') as any)
        .insert([{
          company_id:    companyId,
          name:          `Cópia de ${item.name}`,
          category:      item.category ?? 'geral',
          unit:          item.unit ?? 'un',
          cost_per_unit: Number(item.cost_per_unit) ?? 0,
          supplier:      item.supplier ?? null,
          observations:  item.observations ?? null,
          // quantity/minimum_quantity ficam no default (0) — cópia é
          // de material, não de estoque físico.
        }])
        .select()
        .single()
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['inventory', companyId] })
      toast('success', 'Material duplicado com sucesso!')
      if (newItem) openEdit(newItem)
    } catch (err: unknown) {
      toast('error', `Erro ao duplicar: ${(err as Error).message}`)
    }
  }

  const filtered = (items ?? []).filter((i: Record<string, any>) =>
    (i.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-enter">
      <Header
        title="Materiais"
        subtitle="Cadastro dos materiais usados na produção"
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar material..."
              className="input pl-9 w-full sm:w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={() => { reset(); setEditingId(null); setShowModal(true) }}
            className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto"
          >
            <Plus size={16} />
            Novo Material
          </button>
        </div>

        {/* Lista */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Nenhum material cadastrado"
              description="Cadastre os materiais que você usa na produção para vincular à Precificação e ao Estoque."
              action={{ label: '+ Novo Material', onClick: () => setShowModal(true) }}
            />
          ) : (
            <>
              {/* ── MOBILE ── */}
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {filtered.map((item: Record<string, any>) => (
                  <div key={item.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
                          <Layers size={15} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                          {item.supplier && <p className="text-xs text-text-muted truncate">{item.supplier}</p>}
                        </div>
                      </div>
                      <span className="badge badge-primary flex-shrink-0">{item.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-primary">
                        {fmt(Number(item.cost_per_unit))} <span className="text-[10px] font-normal text-text-muted">/{item.unit}</span>
                      </p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)}
                          className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-primary-50 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDuplicate(item)}
                          className="p-2 rounded-xl text-text-muted hover:text-info hover:bg-info-light transition-colors">
                          <Copy size={14} />
                        </button>
                        <button onClick={() => setDeleteId(item.id)}
                          className="p-2 rounded-xl text-text-muted hover:text-error hover:bg-error-light transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {item.observations && (
                      <p className="text-xs text-text-muted line-clamp-2">{item.observations}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* ── DESKTOP ── */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                      {['Material', 'Categoria', 'Unidade', 'Custo/Un', 'Fornecedor', 'Ações'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item: Record<string, any>) => (
                      <tr key={item.id}
                        className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                              <Layers size={14} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-text-primary dark:text-stone-100">{item.name}</p>
                              {item.observations && <p className="text-xs text-text-muted truncate max-w-xs">{item.observations}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4"><span className="badge badge-primary">{item.category}</span></td>
                        <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{item.unit}</td>
                        <td className="p-4 text-sm font-medium text-text-primary dark:text-stone-100">{fmt(Number(item.cost_per_unit))}</td>
                        <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{item.supplier || '—'}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => handleDuplicate(item)} className="p-1.5 rounded-lg text-text-muted hover:text-info hover:bg-info-light transition-colors"><Copy size={14} /></button>
                            <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-2xl animate-scaleIn max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-border dark:border-border-dark flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">
                {editingId ? 'Editar Material' : 'Novo Material'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={16} />
              </button>
            </div>

            <form
              id="materiais-form"
              onSubmit={handleSubmit(d => saveMutation.mutate(d))}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Nome do material *
                  </label>
                  <input className="input" placeholder="Ex: Papelão duplex" {...register('name')} />
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Categoria *
                  </label>
                  {!isCustomCategory ? (
                    <select
                      className="input"
                      value={watch('category') ?? 'geral'}
                      onChange={e => {
                        if (e.target.value === '__new__') {
                          setIsCustomCategory(true)
                          setValue('category', '')
                        } else {
                          setValue('category', e.target.value)
                        }
                      }}
                    >
                      <optgroup label="Categorias">
                        {PRESET_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                        {customCategories.map(cat => (
                          <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                        ))}
                      </optgroup>
                      <option value="__new__">+ Criar nova categoria</option>
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        className="input"
                        placeholder="Digite o nome da nova categoria"
                        autoFocus
                        {...register('category', { required: true })}
                      />
                      <button
                        type="button"
                        onClick={() => { setIsCustomCategory(false); setValue('category', 'geral') }}
                        className="text-xs text-text-muted dark:text-stone-400 hover:text-primary transition-colors flex items-center gap-1"
                      >
                        ← Voltar para categorias padrão
                      </button>
                    </div>
                  )}
                  {errors.category && <p className="mt-1 text-xs text-error">Categoria obrigatória</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Unidade *
                  </label>
                  <select className="input" {...register('unit')}>
                    {['un', 'kg', 'g', 'ml', 'l', 'm', 'cm', 'rolo', 'pacote'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Custo por unidade (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    placeholder="Ex: 2,00"
                    {...register('cost_per_unit')}
                  />
                  <p className="mt-1.5 text-[10px] text-text-muted dark:text-stone-500">
                    Usado na Precificação. A quantidade em estoque é ajustada na tela Estoque.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Fornecedor
                  </label>
                  <input className="input" placeholder="Nome do fornecedor" {...register('supplier')} />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Observações
                  </label>
                  <textarea
                    className="input min-h-[72px] resize-y"
                    placeholder="Ex: comprar sempre na mesma gráfica, cuidado com umidade, etc."
                    {...register('observations')}
                  />
                </div>
              </div>
            </form>

            <div className="flex flex-col sm:flex-row gap-3 p-6 pt-4 border-t border-border dark:border-border-dark flex-shrink-0">
              <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                type="submit"
                form="materiais-form"
                disabled={saveMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-error" />
            </div>
            <h3 className="text-base font-semibold mb-2 text-text-primary dark:text-stone-100">
              Remover este material?
            </h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">
              Esta ação não pode ser desfeita. Se o material estiver vinculado a produtos, a precificação deles pode ser afetada.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId!)}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50"
              >
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
