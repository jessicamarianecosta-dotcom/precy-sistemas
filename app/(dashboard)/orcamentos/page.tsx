'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  FileText, Plus, X, Loader2, Trash2, Download,
  CheckCircle, XCircle, Clock, Send, Edit2, Copy,
  Package, User, DollarSign, CalendarDays,
} from 'lucide-react'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_CONFIG = {
  draft: {
    label: 'Rascunho',
    badge: 'badge-primary',
    icon: Clock,
  },

  sent: {
    label: 'Enviado',
    badge: 'badge-info',
    icon: Send,
  },

  approved: {
    label: 'Aprovado',
    badge: 'badge-success',
    icon: CheckCircle,
  },

  rejected: {
    label: 'Rejeitado',
    badge: 'badge-error',
    icon: XCircle,
  },

  converted: {
    label: 'Convertido',
    badge: 'badge-warning',
    icon: CheckCircle,
  },
}

const itemSchema = z.object({
  product_id: z.string().min(1, 'Selecione'),

  quantity: z.coerce.number().min(1),

  unit_price: z.coerce.number().min(0),

  subtotal: z.coerce.number().min(0),
})

const schema = z.object({
  customer_id: z.string().min(
    1,
    'Selecione um cliente'
  ),

  notes: z.string().optional(),

  valid_until: z.string().optional(),

  discount: z.coerce
    .number()
    .min(0)
    .default(0),

  items: z
    .array(itemSchema)
    .min(1, 'Adicione ao menos um item'),
})

type FormData = z.infer<typeof schema>

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v)
}

export default function OrcamentosPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { companyId } = useCompanyId()

  const [companyData, setCompanyData] =
    useState<Record<string, unknown> | null>(
      null
    )

  const [showModal, setShowModal] =
    useState(false)

  const [generating, setGenerating] = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [deleteId, setDeleteId]         = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const response: any = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const co = response?.data

      if (co?.id) {
        setCompanyData(co)
      }
    }

    load()
  }, [])

  const {
    data: budgets,
    isLoading,
  } = useQuery({
    queryKey: ['budgets', companyId],

    enabled: !!companyId,

    queryFn: async () => {
      const response: any = await supabase
        .from('budgets')
        .select(
          '*, customers(name, email, phone, city, state)'
        )
        .eq('company_id', companyId!)
        .order('created_at', {
          ascending: false,
        })

      return response?.data ?? []
    },
  })

  const { data: customers } = useQuery({
    queryKey: ['customers-select', companyId],

    enabled: !!companyId,

    queryFn: async () => {
      const response: any = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId!)
        .order('name')

      return response?.data ?? []
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products-select', companyId],

    enabled: !!companyId,

    queryFn: async () => {
      const response: any = await supabase
        .from('products')
        .select(
          'id, name, final_price, unit'
        )
        .eq('company_id', companyId!)
        .eq('is_active', true)

      return response?.data ?? []
    },
  })

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),

    defaultValues: {
      items: [
        {
          product_id: '',
          quantity: 1,
          unit_price: 0,
          subtotal: 0,
        },
      ],

      discount: 0,
    },
  })

  const {
    fields,
    append,
    remove,
  } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedItems = watch('items')

  const watchedDiscount =
    watch('discount') ?? 0

  const subtotalCalc = watchedItems.reduce(
    (s, i) =>
      s + (Number(i.subtotal) || 0),
    0
  )

  const totalCalc = Math.max(
    0,
    subtotalCalc - Number(watchedDiscount)
  )

  function handleItemChange(
    index: number,
    field:
      | 'product_id'
      | 'quantity'
      | 'unit_price',
    value: string
  ) {
    const items = watchedItems

    if (field === 'product_id') {
      const prod = products?.find(
        (p: any) => p.id === value
      )

      if (prod) {
        setValue(
          `items.${index}.unit_price`,
          Number(prod.final_price)
        )
      }
    }

    const qty =
      field === 'quantity'
        ? parseFloat(value) || 0
        : Number(items[index]?.quantity) || 0

    const price =
      field === 'unit_price'
        ? parseFloat(value) || 0
        : Number(items[index]?.unit_price) ||
          0

    const pid =
      field === 'product_id'
        ? value
        : items[index]?.product_id ?? ''

    const prod = products?.find(
      (p: any) => p.id === pid
    )

    const unitPrice =
      field === 'unit_price'
        ? parseFloat(value) || 0
        : Number(prod?.final_price ?? price)

    setValue(
      `items.${index}.subtotal`,
      qty * unitPrice
    )

    if (field !== 'unit_price') {
      setValue(
        `items.${index}.unit_price`,
        unitPrice
      )
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response: any = await (
        supabase.from('budgets') as any
      )
        .insert([
          {
            company_id: companyId!,
            customer_id: data.customer_id,
            notes: data.notes,

            valid_until: data.valid_until
              ? new Date(
                  data.valid_until
                ).toISOString()
              : null,

            subtotal: subtotalCalc,
            discount: data.discount,
            total: totalCalc,
            status: 'draft',
            budget_number: '',
          },
        ])
        .select()
        .single()

      const budget = response?.data

      if (budget?.id) {
        const itemsToInsert =
          data.items.map((i) => ({
            budget_id: budget.id,
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            subtotal: i.subtotal,
          }))

        await (
          supabase.from('budget_items') as any
        ).insert(itemsToInsert)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budgets', companyId],
      })

      toast('success', 'Orçamento salvo!')
      setShowModal(false)
      reset()
      setEditingId(null)
    },
    onError: (err: Error) => {
      console.error('[module] error:', err)
      toast('error', `Erro ao salvar: ${err.message}`)
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: string
    }) => {
      await (
        supabase.from('budgets') as any
      )
        .update({
          status,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', id)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budgets', companyId],
      })
    },
    onError: (err: Error) => {
      console.error('[module] error:', err)
      toast('error', `Erro: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await (
        supabase.from('budgets') as any
      )
        .delete()
        .eq('id', id)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budgets', companyId],
      })
    },
    onError: (err: Error) => {
      console.error('[module] error:', err)
      toast('error', `Erro: ${err.message}`)
    },
  })

  async function handleGeneratePDF(
    budget: any
  ) {
    setGenerating(true)

    try {
      const response: any = await supabase
        .from('budget_items')
        .select(
          '*, products(name, unit)'
        )
        .eq('budget_id', budget.id)

      const items =
        response?.data ?? []

      const {
        generateBudgetPDF,
      } = await import(
        '@/lib/pdf/generateBudgetPDF'
      )

      await generateBudgetPDF({
        budget,
        items,
        company: companyData,
      })
    } finally {
      setGenerating(false)
    }
  }

  function openNew() {
    reset({
      items: [{ product_id: '', quantity: 1, unit_price: 0, subtotal: 0 }],
      discount: 0,
    })
    setEditingId(null)
    setShowModal(true)
  }

  return (
    <div className="page-enter">
      <Header title="Orçamentos" subtitle="Crie e envie orçamentos profissionais em PDF" />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary dark:text-stone-400">
            {budgets?.length ?? 0} orçamento{budgets?.length !== 1 ? 's' : ''}
          </p>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Novo Orçamento
          </button>
        </div>

        {/* Lista */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={4} /></div>
          ) : !budgets?.length ? (
            <EmptyState icon={FileText} title="Nenhum orçamento ainda"
              description="Crie orçamentos profissionais e gere PDFs para enviar aos clientes."
              action={{ label: '+ Novo Orçamento', onClick: openNew }} />
          ) : (
            <>
              {/* ── MOBILE: cards ── */}
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {budgets.map((b: any) => {
                  const cfg = STATUS_CONFIG[b.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
                  const Icon = cfg.icon
                  return (
                    <div key={b.id} className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-bold text-primary">{b.budget_number || '—'}</p>
                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100">
                            {(b.customers as any)?.name ?? '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-primary">{fmt(Number(b.total))}</p>
                          <span className={clsx('badge text-[10px]', cfg.badge)}>{cfg.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={() => handleGeneratePDF(b)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-colors">
                          {generating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                          PDF
                        </button>
                        <button onClick={() => setDeleteId(b.id)}
                          className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── DESKTOP: tabela ── */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                      {['Número', 'Cliente', 'Status', 'Total', 'Validade', 'Ações'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((b: any) => {
                      const cfg = STATUS_CONFIG[b.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
                      const Icon = cfg.icon
                      return (
                        <tr key={b.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 text-sm font-mono text-primary">{b.budget_number || '—'}</td>
                          <td className="p-4 text-sm text-text-primary dark:text-stone-100">
                            {(b.customers as any)?.name ?? '—'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Icon size={13} />
                              <span className={clsx('badge', cfg.badge)}>{cfg.label}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm font-bold text-primary">{fmt(Number(b.total))}</td>
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-300">
                            {b.valid_until ? format(new Date(b.valid_until), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleGeneratePDF(b)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors" title="Gerar PDF">
                                {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                              </button>
                              <button onClick={() => setDeleteId(b.id)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors" title="Excluir">
                                <Trash2 size={14} />
                              </button>
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

      {/* ═══════════════════════════════════════
          MODAL CRIAR ORÇAMENTO
      ════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-2xl max-h-[96dvh] sm:max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-modal animate-scaleIn overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-text-primary dark:text-stone-100">Novo Orçamento</h2>
                <p className="text-xs text-text-muted dark:text-stone-500 mt-0.5">Preencha os dados e salve</p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={16} />
              </button>
            </div>

            {/* Form (scrollable) */}
            <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-5 space-y-5">

                {/* ── S1: Cliente ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <User size={12} /> Cliente *
                  </h3>
                  <select className="input" {...register('customer_id')}>
                    <option value="">Selecione um cliente...</option>
                    {(customers ?? []).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.customer_id && <p className="text-xs text-error">{errors.customer_id.message}</p>}
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S2: Itens ── */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                      <Package size={12} /> Itens do Orçamento
                    </h3>
                    <button type="button"
                      onClick={() => append({ product_id: '', quantity: 1, unit_price: 0, subtotal: 0 })}
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Plus size={12} /> Adicionar item
                    </button>
                  </div>

                  {/* Header da tabela (só desktop) */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-1 border-b border-border dark:border-border-dark">
                    {['Produto / Serviço', 'Qtd', 'Valor unit.', 'Subtotal', ''].map((h, i) => (
                      <span key={h} className={`text-[10px] font-semibold text-text-muted uppercase ${i === 0 ? 'col-span-5' : i === 4 ? 'col-span-1' : 'col-span-2'}`}>{h}</span>
                    ))}
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="sm:grid sm:grid-cols-12 sm:gap-2 flex flex-col gap-2 p-3 sm:p-0 bg-primary-50/30 dark:bg-primary/5 sm:bg-transparent rounded-xl sm:rounded-none">
                        {/* Produto */}
                        <div className="sm:col-span-5">
                          <select className="input text-sm"
                            {...register(`items.${index}.product_id`)}
                            onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}>
                            <option value="">Produto / serviço manual...</option>
                            {(products ?? []).map((p: any) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Qtd */}
                        <div className="sm:col-span-2">
                          <input type="number" min="1" step="1" className="input text-sm" placeholder="Qtd"
                            {...register(`items.${index}.quantity`)}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                        </div>

                        {/* Valor unit */}
                        <div className="sm:col-span-2">
                          <input type="number" step="0.01" className="input text-sm" placeholder="R$ 0,00"
                            {...register(`items.${index}.unit_price`)}
                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} />
                        </div>

                        {/* Subtotal */}
                        <div className="sm:col-span-2">
                          <input type="number" readOnly className="input text-sm bg-primary-50 dark:bg-primary/10 font-semibold text-primary"
                            {...register(`items.${index}.subtotal`)} />
                        </div>

                        {/* Remove */}
                        <div className="sm:col-span-1 flex items-center">
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(index)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {errors.items && <p className="text-xs text-error">Adicione pelo menos um item com valor válido.</p>}
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S3: Valores ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <DollarSign size={12} /> Valores
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Subtotal</label>
                      <input type="text" readOnly value={fmt(subtotalCalc)}
                        className="input bg-primary-50/50 dark:bg-primary/5 text-sm font-semibold" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Desconto (R$)</label>
                      <input type="number" step="0.01" className="input text-sm" placeholder="0,00" {...register('discount')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Total</label>
                      <input type="text" readOnly value={fmt(totalCalc)}
                        className="input bg-primary-50 dark:bg-primary/10 text-sm font-bold text-primary" />
                    </div>
                  </div>
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S4: Validade + Observações ── */}
                <section className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1 flex items-center gap-1">
                        <CalendarDays size={11} /> Válido até
                      </label>
                      <input type="date" className="input text-sm" {...register('valid_until')} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Observações</label>
                    <textarea rows={3} className="input resize-none text-sm" placeholder="Condições, prazos, detalhes..." {...register('notes')} />
                  </div>
                </section>

              </div>

              {/* Footer fixo */}
              <div className="flex-shrink-0 sticky bottom-0 p-4 sm:p-5 border-t border-border dark:border-border-dark bg-white dark:bg-surface-dark flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar Orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal excluir */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-error" />
            </div>
            <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-2">Excluir orçamento?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => { deleteMutation.mutate(deleteId!); setDeleteId(null) }}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50">
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />} Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
