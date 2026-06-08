'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  FileText, Plus, X, Loader2, Trash2, Download,
  CheckCircle, XCircle, Clock, Send, Eye
} from 'lucide-react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_CONFIG = {
  draft:     { label: 'Rascunho',  badge: 'badge-primary',  icon: Clock },
  sent:      { label: 'Enviado',   badge: 'badge-info',     icon: Send },
  approved:  { label: 'Aprovado',  badge: 'badge-success',  icon: CheckCircle },
  rejected:  { label: 'Rejeitado', badge: 'badge-error',    icon: XCircle },
  converted: { label: 'Convertido',badge: 'badge-warning',  icon: CheckCircle },
}

const itemSchema = z.object({
  product_id:  z.string().min(1, 'Selecione'),
  quantity:    z.coerce.number().min(1),
  unit_price:  z.coerce.number().min(0),
  subtotal:    z.coerce.number().min(0),
})

const schema = z.object({
  customer_id: z.string().min(1, 'Selecione um cliente'),
  notes:       z.string().optional(),
  valid_until: z.string().optional(),
  discount:    z.coerce.number().min(0).default(0),
  items:       z.array(itemSchema).min(1, 'Adicione ao menos um item'),
})

type FormData = z.infer<typeof schema>

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function OrcamentosPage() {
  const supabase      = createClient()
  const queryClient   = useQueryClient()
  const [companyId, setCompanyId]   = useState<string | null>(null)
  const [companyData, setCompanyData] = useState<Record<string, unknown> | null>(null)
  const [showModal, setShowModal]   = useState(false)
  const [viewBudget, setViewBudget] = useState<Record<string, unknown> | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: co } = await supabase
        .from('companies').select('*').eq('user_id', user.id).single()
      if (co) { setCompanyId(co.id); setCompanyData(co) }
    }
    load()
  }, [])

  /* ---- Queries ---- */
  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', companyId],
    enabled:  !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('budgets')
        .select('*, customers(name, email, phone, city, state)')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: customers } = useQuery({
    queryKey: ['customers-select', companyId],
    enabled:  !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('customers').select('id, name').eq('company_id', companyId!).order('name')
      return data ?? []
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products-select', companyId],
    enabled:  !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('products').select('id, name, final_price, unit').eq('company_id', companyId!).eq('is_active', true)
      return data ?? []
    },
  })

  /* ---- Form ---- */
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ product_id: '', quantity: 1, unit_price: 0, subtotal: 0 }], discount: 0 },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems    = watch('items')
  const watchedDiscount = watch('discount') ?? 0

  const subtotalCalc = watchedItems.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)
  const totalCalc    = Math.max(0, subtotalCalc - Number(watchedDiscount))

  function handleItemChange(index: number, field: 'product_id' | 'quantity' | 'unit_price', value: string) {
    const items = watchedItems
    if (field === 'product_id') {
      const prod = products?.find(p => p.id === value)
      if (prod) setValue(`items.${index}.unit_price`, prod.final_price)
    }
    const qty   = field === 'quantity'   ? parseFloat(value) || 0 : Number(items[index]?.quantity)   || 0
    const price = field === 'unit_price' ? parseFloat(value) || 0 : Number(items[index]?.unit_price) || 0
    const pid   = field === 'product_id' ? value : items[index]?.product_id ?? ''

    const prod       = products?.find(p => p.id === pid)
    const unitPrice  = field === 'unit_price' ? parseFloat(value) || 0 : (prod?.final_price ?? price)
    setValue(`items.${index}.subtotal`, qty * unitPrice)
    if (field !== 'unit_price') setValue(`items.${index}.unit_price`, unitPrice)
  }

  /* ---- Save ---- */
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: budget } = await supabase
        .from('budgets')
        .insert({
          company_id:  companyId!,
          customer_id: data.customer_id,
          notes:       data.notes,
          valid_until: data.valid_until ? new Date(data.valid_until).toISOString() : null,
          subtotal:    subtotalCalc,
          discount:    data.discount,
          total:       totalCalc,
          status:      'draft',
          budget_number: '',
        })
        .select().single()

      if (budget?.id) {
        const itemsToInsert = data.items.map(i => ({
          budget_id:   budget.id,
          product_id:  i.product_id,
          quantity:    i.quantity,
          unit_price:  i.unit_price,
          subtotal:    i.subtotal,
        }))
        await supabase.from('budget_items').insert(itemsToInsert)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', companyId] })
      setShowModal(false)
      reset()
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('budgets').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets', companyId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('budgets').delete().eq('id', id) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets', companyId] }),
  })

  /* ---- PDF ---- */
  async function handleGeneratePDF(budget: Record<string, unknown>) {
    setGenerating(true)
    try {
      const { data: items } = await supabase
        .from('budget_items')
        .select('*, products(name, unit)')
        .eq('budget_id', budget.id as string)

      const { generateBudgetPDF } = await import('@/lib/pdf/generateBudgetPDF')
      await generateBudgetPDF({
        budget,
        items:   items ?? [],
        company: companyData,
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="page-enter">
      <Header title="Orçamentos" subtitle="Crie e envie orçamentos profissionais em PDF" />
      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary dark:text-stone-400">
            {budgets?.length ?? 0} orçamento{budgets?.length !== 1 ? 's' : ''} criado{budgets?.length !== 1 ? 's' : ''}
          </p>
          <button onClick={() => { reset(); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Novo Orçamento
          </button>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : !budgets?.length ? (
            <EmptyState
              icon={FileText}
              title="Nenhum orçamento ainda"
              description="Crie orçamentos profissionais e gere PDFs para enviar aos clientes."
              action={{ label: '+ Novo Orçamento', onClick: () => setShowModal(true) }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    {['Número', 'Cliente', 'Status', 'Total', 'Válido até', 'Ações'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {budgets.map(b => {
                    const cfg = STATUS_CONFIG[b.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
                    const Icon = cfg.icon
                    return (
                      <tr key={b.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
                              <FileText size={14} className="text-primary" />
                            </div>
                            <span className="text-sm font-medium text-text-primary dark:text-stone-100">{b.budget_number}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-text-secondary dark:text-stone-300">
                          {(b.customers as Record<string, unknown>)?.name as string}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <Icon size={13} className={clsx(
                              b.status === 'approved' ? 'text-success' :
                              b.status === 'rejected' ? 'text-error' :
                              b.status === 'sent' ? 'text-info' : 'text-text-muted'
                            )} />
                            <span className={clsx('badge', cfg.badge)}>{cfg.label}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm font-bold text-primary">{fmt(Number(b.total))}</td>
                        <td className="p-4 text-sm text-text-secondary dark:text-stone-300">
                          {b.valid_until
                            ? format(new Date(b.valid_until as string), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {/* Download PDF */}
                            <button
                              onClick={() => handleGeneratePDF(b)}
                              disabled={generating}
                              title="Baixar PDF"
                              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"
                            >
                              {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            </button>
                            {/* Aprovar */}
                            {b.status === 'sent' && (
                              <button
                                onClick={() => updateStatus.mutate({ id: b.id, status: 'approved' })}
                                title="Marcar aprovado"
                                className="p-1.5 rounded-lg text-text-muted hover:text-success hover:bg-success-light transition-colors"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}
                            {/* Enviar */}
                            {b.status === 'draft' && (
                              <button
                                onClick={() => updateStatus.mutate({ id: b.id, status: 'sent' })}
                                title="Marcar como enviado"
                                className="p-1.5 rounded-lg text-text-muted hover:text-info hover:bg-info-light transition-colors"
                              >
                                <Send size={14} />
                              </button>
                            )}
                            {/* Delete */}
                            <button
                              onClick={() => deleteMutation.mutate(b.id)}
                              title="Excluir"
                              className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"
                            >
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
          )}
        </div>
      </div>

      {/* Modal Novo Orçamento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-2xl animate-scaleIn max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-border dark:border-border-dark flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">Novo Orçamento</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"><X size={16} /></button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Cliente + Validade */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Cliente *</label>
                  <select className="input" {...register('customer_id')}>
                    <option value="">Selecione um cliente</option>
                    {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {errors.customer_id && <p className="mt-1 text-xs text-error">{errors.customer_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Válido até</label>
                  <input type="date" className="input" {...register('valid_until')} />
                </div>
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-text-primary dark:text-stone-200">Itens do Orçamento *</label>
                  <button type="button" onClick={() => append({ product_id: '', quantity: 1, unit_price: 0, subtotal: 0 })}
                    className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                    <Plus size={12} /> Adicionar item
                  </button>
                </div>
                <div className="space-y-2.5">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-center bg-primary-50/40 dark:bg-white/[0.03] p-3 rounded-xl">
                      <div className="col-span-5">
                        <select className="input text-xs py-2"
                          {...register(`items.${index}.product_id`)}
                          onChange={e => { handleItemChange(index, 'product_id', e.target.value); register(`items.${index}.product_id`).onChange(e) }}>
                          <option value="">Produto</option>
                          {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" step="1" min="1" placeholder="Qtd" className="input text-xs py-2"
                          {...register(`items.${index}.quantity`)}
                          onChange={e => { handleItemChange(index, 'quantity', e.target.value); register(`items.${index}.quantity`).onChange(e) }} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" step="0.01" placeholder="R$" className="input text-xs py-2"
                          {...register(`items.${index}.unit_price`)}
                          onChange={e => { handleItemChange(index, 'unit_price', e.target.value); register(`items.${index}.unit_price`).onChange(e) }} />
                      </div>
                      <div className="col-span-2">
                        <input readOnly className="input text-xs py-2 bg-primary-50 dark:bg-primary/10 font-semibold text-primary"
                          value={fmt(Number(watchedItems[index]?.subtotal) || 0)} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="text-text-muted hover:text-error transition-colors">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {errors.items && <p className="mt-1 text-xs text-error">{errors.items.message as string}</p>}
              </div>

              {/* Totais */}
              <div className="bg-primary-50 dark:bg-primary/10 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary dark:text-stone-400">Subtotal</span>
                  <span className="font-medium text-text-primary dark:text-stone-100">{fmt(subtotalCalc)}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-text-secondary dark:text-stone-400">Desconto (R$)</span>
                  <input type="number" step="0.01" min="0" placeholder="0,00"
                    className="input text-sm w-28 py-1.5 text-right" {...register('discount')} />
                </div>
                <div className="flex justify-between pt-2 border-t border-primary/20">
                  <span className="text-sm font-semibold text-text-primary dark:text-stone-100">Total</span>
                  <span className="text-lg font-bold text-primary">{fmt(totalCalc)}</span>
                </div>
              </div>

              {/* Obs */}
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Observações</label>
                <textarea rows={2} className="input resize-none" placeholder="Condições de pagamento, prazos, etc." {...register('notes')} />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : 'Criar Orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
