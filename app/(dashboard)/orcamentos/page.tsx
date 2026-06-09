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
  FileText,
  Plus,
  X,
  Loader2,
  Trash2,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Send,
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

  const [generating, setGenerating] =
    useState(false)

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

      setShowModal(false)

      reset()
    },
    onError: (err: Error) => {
      console.error('[module] error:', err)
      toast('error', `Erro: ${err.message}`)
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

  return (
    <div className="page-enter">
      <Header
        title="Orçamentos"
        subtitle="Crie e envie orçamentos profissionais em PDF"
      />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary dark:text-stone-400">
            {budgets?.length ?? 0}{' '}
            orçamento
            {budgets?.length !== 1
              ? 's'
              : ''}{' '}
            criado
            {budgets?.length !== 1
              ? 's'
              : ''}
          </p>

          <button
            onClick={() => {
              reset()
              setShowModal(true)
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Novo Orçamento
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={5} />
            </div>
          ) : !budgets?.length ? (
            <EmptyState
              icon={FileText}
              title="Nenhum orçamento ainda"
              description="Crie orçamentos profissionais e gere PDFs para enviar aos clientes."
              action={{
                label: '+ Novo Orçamento',
                onClick: () =>
                  setShowModal(true),
              }}
            />
          ) : (
            <div className="overflow-x-auto -mx-0 w-full">
              <table className="w-full">
                <tbody>
                  {budgets.map((b: any) => {
                    const cfg =
                      STATUS_CONFIG[
                        b.status as keyof typeof STATUS_CONFIG
                      ] ??
                      STATUS_CONFIG.draft

                    const Icon = cfg.icon

                    return (
                      <tr key={b.id}>
                        <td className="p-4">
                          {b.budget_number}
                        </td>

                        <td className="p-4">
                          {
                            (
                              b.customers as any
                            )?.name
                          }
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Icon size={14} />

                            <span
                              className={clsx(
                                'badge',
                                cfg.badge
                              )}
                            >
                              {cfg.label}
                            </span>
                          </div>
                        </td>

                        <td className="p-4 font-bold text-primary">
                          {fmt(
                            Number(b.total)
                          )}
                        </td>

                        <td className="p-4">
                          {b.valid_until
                            ? format(
                                new Date(
                                  b.valid_until
                                ),
                                'dd/MM/yyyy',
                                {
                                  locale:
                                    ptBR,
                                }
                              )
                            : '—'}
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleGeneratePDF(
                                  b
                                )
                              }
                            >
                              {generating ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Download size={14} />
                              )}
                            </button>

                            <button
                              onClick={() =>
                                deleteMutation.mutate(
                                  b.id
                                )
                              }
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() =>
              setShowModal(false)
            }
          />

          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-2xl">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Novo Orçamento
              </h2>

              <button
                onClick={() =>
                  setShowModal(false)
                }
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit((d) =>
                saveMutation.mutate(d)
              )}
              className="p-3 sm:p-5 lg:p-6 space-y-4"
            >
              <button
                type="submit"
                disabled={
                  saveMutation.isPending
                }
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {saveMutation.isPending && (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                )}

                {saveMutation.isPending
                  ? 'Salvando...'
                  : 'Criar Orçamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
