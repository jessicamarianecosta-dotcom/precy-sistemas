'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { clsx } from 'clsx'

/* ─────────────────────────────────────────────
   Schema
───────────────────────────────────────────── */

const schema = z.object({
  name:             z.string().min(2, 'Nome obrigatório'),
  category:         z.string().default('geral'),
  unit:             z.string().default('un'),
  quantity:         z.coerce.number().min(0),
  total_paid:       z.coerce.number().min(0),   // valor total pago na compra
  minimum_quantity: z.coerce.number().min(0),
  supplier:         z.string().optional(),
})

type FormData = z.infer<typeof schema>

/* ─────────────────────────────────────────────
   Status
───────────────────────────────────────────── */

const STATUS_CFG = {
  healthy: {
    label: 'Saudável',
    badge: 'badge-success',
    icon: CheckCircle,
    iconCls: 'text-success',
    bg: 'bg-success-light dark:bg-success/10',
  },

  attention: {
    label: 'Atenção',
    badge: 'badge-warning',
    icon: AlertTriangle,
    iconCls: 'text-warning',
    bg: 'bg-warning-light dark:bg-warning/10',
  },

  critical: {
    label: 'Crítico',
    badge: 'badge-error',
    icon: AlertTriangle,
    iconCls: 'text-error',
    bg: 'bg-error-light dark:bg-error/10',
  },
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v)
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   Categorias pré-definidas
───────────────────────────────────────────── */

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

export default function EstoquePage() {
  const supabase = createClient()

  const qc = useQueryClient()

  const { toast } = useToast()

  const { companyId } = useCompanyId()

  const [showModal, setShowModal] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)

  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [search, setSearch] = useState('')

  const [filterStatus, setFilterStatus] = useState('all')
  /* categoria híbrida */
  const [isCustomCategory,  setIsCustomCategory]  = useState(false)
  const [customCategories,  setCustomCategories]  = useState<string[]>([])

  /* ─────────────────────────────────────────────
     Query
  ───────────────────────────────────────────── */

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

  /* ─────────────────────────────────────────────
     Form
  ───────────────────────────────────────────── */

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
      quantity: 1,
      total_paid: 0,
      minimum_quantity: 5,
      category: 'geral',
    },
  })

  /* ─────────────────────────────────────────────
     Save
  ───────────────────────────────────────────── */

  const saveMutation = useMutation({
    mutationFn: async (d: FormData) => {
      // Calcular custo unitário: total pago ÷ quantidade
      const qty          = d.quantity > 0 ? d.quantity : 1
      const cost_per_unit = d.quantity > 0 ? d.total_paid / d.quantity : 0

      // Payload sem total_paid (campo de UI, não existe no banco)
      const { total_paid: _t, ...rest } = d
      // 'status' é coluna GERADA no banco — nunca enviar no payload
      const payload = { ...rest, cost_per_unit }

      if (editingId) {
        const { error } = await (supabase.from('inventory') as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('inventory') as any)
          .insert([{ ...payload, company_id: companyId! }])
          .select()
        if (error) throw error
      }
    },

    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['inventory', companyId] })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })

      // Quando atualiza um item existente, o trigger no banco recalcula
      // product_materials e products automaticamente — invalida o cache
      if (editingId) {
        qc.invalidateQueries({ queryKey: ['products', companyId] })
        qc.invalidateQueries({ queryKey: ['product-materials'] })
        toast('success', 'Material atualizado! Produtos vinculados recalculados automaticamente.')
      } else {
        toast('success', 'Item adicionado ao estoque!')
      }

      // Persistir nova categoria se for customizada
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
      console.error('[estoque] save error:', err)

      toast('error', `Erro ao salvar: ${err.message}`)
    },
  })

  /* ─────────────────────────────────────────────
     Delete
  ───────────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('inventory') as any)
        .delete()
        .eq('id', id)

      if (error) throw error
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['inventory', companyId],
      })

      qc.invalidateQueries({
        queryKey: ['dashboard', companyId],
      })

      toast('success', 'Item removido do estoque.')

      setDeleteId(null)
    },

    onError: (err: Error) => {
      console.error('[estoque] delete error:', err)

      toast('error', `Erro ao excluir: ${err.message}`)
    },
  })

  /* ─────────────────────────────────────────────
     Helpers
  ───────────────────────────────────────────── */

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
    const qty     = Number(item.quantity || 0)
    const cpu     = Number(item.cost_per_unit || 0)
    setValue('quantity',         qty)
    setValue('total_paid',       qty > 0 ? Math.round(cpu * qty * 100) / 100 : 0)
    setValue('minimum_quantity', Number(item.minimum_quantity || 0))
    setValue('supplier', item.supplier || '')

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
          company_id:       companyId,
          name:             `Cópia de ${item.name}`,
          category:         item.category         ?? 'geral',
          unit:             item.unit              ?? 'un',
          quantity:         Number(item.quantity)  ?? 0,
          minimum_quantity: Number(item.minimum_quantity) ?? 0,
          cost_per_unit:    Number(item.cost_per_unit)    ?? 0,
          total_paid:       Number(item.cost_per_unit) * Number(item.quantity),
          supplier:         item.supplier          ?? null,
          notes:            item.notes             ?? null,
        }])
        .select()
        .single()
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['inventory', companyId] })
      toast('success', 'Item duplicado com sucesso!')
      // Abrir novo item em modo edição
      if (newItem) openEdit(newItem)
    } catch (err: unknown) {
      toast('error', `Erro ao duplicar: ${(err as Error).message}`)
    }
  }

  /* ─────────────────────────────────────────────
     Filters
  ───────────────────────────────────────────── */

  const filtered = (items ?? []).filter(
    (i: Record<string, any>) => {
      const matchSearch = (i.name || '')
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchStatus =
        filterStatus === 'all' ||
        i.status === filterStatus

      return matchSearch && matchStatus
    }
  )

  const criticalCount = (items ?? []).filter(
    (i: Record<string, any>) =>
      i.status === 'critical'
  ).length

  const attentionCount = (items ?? []).filter(
    (i: Record<string, any>) =>
      i.status === 'attention'
  ).length

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */

  return (
    <div className="page-enter">
      <Header
        title="Estoque"
        subtitle="Controle de materiais e insumos"
      />

      <div className="p-4 sm:p-6 space-y-4">

        {/* Alertas */}

        {(criticalCount > 0 ||
          attentionCount > 0) && (
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">

            {criticalCount > 0 && (
              <div className="card border-error/30 bg-error-light dark:bg-error/10 p-4 flex items-center gap-3">
                <AlertTriangle
                  size={18}
                  className="text-error flex-shrink-0"
                />

                <div>
                  <p className="text-sm font-semibold text-error-dark">
                    {criticalCount} item
                    {criticalCount > 1
                      ? 's'
                      : ''}{' '}
                    crítico
                    {criticalCount > 1
                      ? 's'
                      : ''}
                  </p>

                  <p className="text-xs text-error/70">
                    Estoque zerado
                  </p>
                </div>
              </div>
            )}

            {attentionCount > 0 && (
              <div className="card border-warning/30 bg-warning-light dark:bg-warning/10 p-4 flex items-center gap-3">
                <AlertTriangle
                  size={18}
                  className="text-warning flex-shrink-0"
                />

                <div>
                  <p className="text-sm font-semibold text-warning-dark">
                    {attentionCount} item
                    {attentionCount > 1
                      ? 's'
                      : ''}{' '}
                    em atenção
                  </p>

                  <p className="text-xs text-warning/70">
                    Abaixo do mínimo
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">

          <div className="flex gap-2 flex-wrap">

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />

              <input
                type="text"
                placeholder="Buscar..."
                className="input pl-9 w-52"
                value={search}
                onChange={e =>
                  setSearch(e.target.value)
                }
              />
            </div>

            <select
              className="input w-36"
              value={filterStatus}
              onChange={e =>
                setFilterStatus(e.target.value)
              }
            >
              <option value="all">
                Todos
              </option>

              <option value="healthy">
                Saudável
              </option>

              <option value="attention">
                Atenção
              </option>

              <option value="critical">
                Crítico
              </option>
            </select>
          </div>

          <button
            onClick={() => {
              reset()

              setEditingId(null)

              setShowModal(true)
            }}
            className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto"
          >
            <Plus size={16} />
            Novo Item
          </button>
        </div>

        {/* Tabela */}

        <div className="card p-0 overflow-hidden">

          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Estoque vazio"
              description="Cadastre seus materiais e controle o estoque de forma inteligente."
              action={{
                label: '+ Novo Item',
                onClick: () =>
                  setShowModal(true),
              }}
            />
          ) : (
            <>
              {/* ── MOBILE: Cards responsivos ── */}
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {filtered.map((item: Record<string, any>) => {
                  const st  = item.status as keyof typeof STATUS_CFG
                  const cfg = STATUS_CFG[st] ?? STATUS_CFG.healthy
                  const Icon = cfg.icon
                  return (
                    <div key={item.id} className="p-4 space-y-3">
                      {/* Row 1: ícone + nome + badge status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
                            <Icon size={15} className={cfg.iconCls} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary dark:text-stone-100 truncate">{item.name}</p>
                            {item.supplier && (
                              <p className="text-xs text-text-muted truncate">{item.supplier}</p>
                            )}
                          </div>
                        </div>
                        <span className={clsx('badge flex-shrink-0', cfg.badge)}>{cfg.label}</span>
                      </div>
                      {/* Row 2: grade de métricas */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-primary-50/40 dark:bg-white/[0.03] rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">Qtd</p>
                          <p className="text-sm font-bold text-text-primary dark:text-stone-100">
                            {Number(item.quantity)} <span className="text-[10px] font-normal text-text-muted">{item.unit}</span>
                          </p>
                        </div>
                        <div className="bg-primary-50/40 dark:bg-white/[0.03] rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">Mín.</p>
                          <p className="text-sm font-bold text-text-primary dark:text-stone-100">
                            {Number(item.minimum_quantity)} <span className="text-[10px] font-normal text-text-muted">{item.unit}</span>
                          </p>
                        </div>
                        <div className="bg-primary-50/40 dark:bg-white/[0.03] rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">Custo/un</p>
                          <p className="text-sm font-bold text-primary">{fmt(Number(item.cost_per_unit))}</p>
                        </div>
                      </div>
                      {/* Row 3: categoria + ações */}
                      <div className="flex items-center justify-between">
                        <span className="badge badge-primary text-[10px]">{item.category}</span>
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
                    </div>
                  )
                })}
              </div>

              {/* ── DESKTOP: Tabela ── */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                      {['Material','Categoria','Quantidade','Mínimo','Custo/Un','Status','Ações'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item: Record<string, any>) => {
                      const st  = item.status as keyof typeof STATUS_CFG
                      const cfg = STATUS_CFG[st] ?? STATUS_CFG.healthy
                      const Icon = cfg.icon
                      return (
                        <tr key={item.id}
                          className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg)}>
                                <Icon size={14} className={cfg.iconCls} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-text-primary dark:text-stone-100">{item.name}</p>
                                {item.supplier && <p className="text-xs text-text-muted">{item.supplier}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="p-4"><span className="badge badge-primary">{item.category}</span></td>
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{Number(item.quantity)} {item.unit}</td>
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{Number(item.minimum_quantity)} {item.unit}</td>
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{fmt(Number(item.cost_per_unit))}</td>
                          <td className="p-4"><span className={clsx('badge', cfg.badge)}>{cfg.label}</span></td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit2 size={14}/></button>
                              <button onClick={() => handleDuplicate(item)} className="p-1.5 rounded-lg text-text-muted hover:text-info hover:bg-info-light transition-colors"><Copy size={14}/></button>
                              <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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

          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-2xl animate-scaleIn">

            {/* Header */}

            <div className="p-4 sm:p-6 border-b border-border dark:border-border-dark flex items-center justify-between">

              <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">
                {editingId
                  ? 'Editar Material'
                  : 'Novo Material'}
              </h2>

              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}

            <form
              onSubmit={handleSubmit(d =>
                saveMutation.mutate(d)
              )}
              className="p-6 space-y-4"
            >

              <div className="grid grid-cols-2 gap-4">

                {/* Nome */}

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Nome do material *
                  </label>

                  <input
                    className="input"
                    placeholder="Ex: Papelão duplex"
                    {...register('name')}
                  />

                  {errors.name && (
                    <p className="mt-1 text-xs text-error">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Categoria — híbrido: select + custom input */}

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
                          <option key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </option>
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
                        onClick={() => {
                          setIsCustomCategory(false)
                          setValue('category', 'geral')
                        }}
                        className="text-xs text-text-muted dark:text-stone-400 hover:text-primary transition-colors flex items-center gap-1"
                      >
                        ← Voltar para categorias padrão
                      </button>
                    </div>
                  )}

                  {errors.category && (
                    <p className="mt-1 text-xs text-error">Categoria obrigatória</p>
                  )}
                </div>

                {/* Unidade */}

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Unidade *
                  </label>

                  <select
                    className="input"
                    {...register('unit')}
                  >
                    {[
                      'un',
                      'kg',
                      'g',
                      'ml',
                      'l',
                      'm',
                      'cm',
                      'rolo',
                      'pacote',
                    ].map(u => (
                      <option
                        key={u}
                        value={u}
                      >
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantidade */}

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Quantidade comprada *
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="Ex: 30"
                    {...register('quantity')}
                  />
                </div>

                {/* Valor Pago Total */}

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Valor total pago (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    placeholder="Ex: 60,00 (pelo lote inteiro)"
                    {...register('total_paid')}
                  />
                  {/* Custo unitário calculado ao vivo */}
                  {(() => {
                    const qty   = Number(watch('quantity') || 0)
                    const total = Number(watch('total_paid') || 0)
                    const unit  = watch('unit') ?? 'un'
                    if (qty > 0 && total > 0) {
                      const cpu = total / qty
                      return (
                        <p className="mt-1.5 text-xs font-medium text-primary flex items-center gap-1">
                          ✓ Custo unitário: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cpu)}/{unit}
                        </p>
                      )
                    }
                    return (
                      <p className="mt-1.5 text-[10px] text-text-muted dark:text-stone-500">
                        Custo/unidade = valor total ÷ quantidade
                      </p>
                    )
                  })()}
                </div>

                {/* Estoque */}

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Estoque mínimo
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="5"
                    {...register(
                      'minimum_quantity'
                    )}
                  />
                </div>

                {/* Fornecedor */}

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Fornecedor
                  </label>

                  <input
                    className="input"
                    placeholder="Nome do fornecedor"
                    {...register('supplier')}
                  />
                </div></div>

              {/* Footer */}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">

                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saveMutation.isPending
                  }
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending && (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  )}

                  {saveMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete */}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              setDeleteId(null)
            }
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6 text-center">

            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
              <Trash2
                size={20}
                className="text-error"
              />
            </div>

            <h3 className="text-base font-semibold mb-2 text-text-primary dark:text-stone-100">
              Remover item do estoque?
            </h3>

            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">
              Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3">

              <button
                onClick={() =>
                  setDeleteId(null)
                }
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>

              <button
                onClick={() =>
                  deleteMutation.mutate(
                    deleteId!
                  )
                }
                disabled={
                  deleteMutation.isPending
                }
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50"
              >
                {deleteMutation.isPending && (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                )}

                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
