'use client'

import { useEffect, useState } from 'react'

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

import { useToast } from '@/components/ui/Toaster'

import { useCompanyId } from '@/hooks/useCompanyId'

import { Header } from '@/components/layout/Header'

import { SkeletonTable } from '@/components/ui/Skeleton'

import { EmptyState } from '@/components/ui/EmptyState'

import {
  ShoppingCart,
  Plus,
  Search,
  X,
  Loader2,
  GripVertical,
  Trash2,
  CalendarDays,
  User,
  DollarSign,
  FileText,
  Package,
} from 'lucide-react'

import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { z } from 'zod'

import { clsx } from 'clsx'

import { format } from 'date-fns'

import { ptBR } from 'date-fns/locale'

/* ─────────────────────────────────────────────
   STATUS
───────────────────────────────────────────── */

const STATUS_COLUMNS = [
  {
    id: 'pending',
    label: 'Pendente',
    color:
      'bg-warning-light dark:bg-warning/10 border-warning/20',
  },

  {
    id: 'production',
    label: 'Produção',
    color:
      'bg-info-light dark:bg-info/10 border-info/20',
  },

  {
    id: 'ready',
    label: 'Pronto',
    color:
      'bg-success-light dark:bg-success/10 border-success/20',
  },

  {
    id: 'delivered',
    label: 'Entregue',
    color:
      'bg-primary-50 dark:bg-primary/10 border-primary/20',
  },
]

/* ─────────────────────────────────────────────
   SCHEMA
───────────────────────────────────────────── */

const schema = z.object({
  customer_id: z.string().min(
    1,
    'Selecione um cliente'
  ),

  service_name: z
    .string()
    .min(2, 'Informe o serviço'),

  description: z.string().optional(),

  status: z.string().default('pending'),

  payment_status: z
    .string()
    .default('pending'),

  subtotal: z.coerce.number().min(0),

  discount: z.coerce
    .number()
    .min(0)
    .default(0),

  total: z.coerce.number().min(0),

  notes: z.string().optional(),

  due_date: z.string().optional(),

  priority: z.string().default('normal'),
})

type FormData = z.infer<typeof schema>

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v)
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */

export default function PedidosPage() {
  const supabase = createClient()

  const queryClient = useQueryClient()

  const { toast } = useToast()

  const { companyId } = useCompanyId()

  const [showModal, setShowModal] =
    useState(false)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState('')

  const [dragging, setDragging] =
    useState<string | null>(null)

  /* ─────────────────────────────────────────────
     QUERIES
  ───────────────────────────────────────────── */

  const {
    data: orders,
    isLoading,
  } = useQuery({
    queryKey: ['orders', companyId],

    enabled: !!companyId,

    queryFn: async () => {
      const response: any = await supabase
        .from('orders')
        .select(
          '*, customers(name, phone)'
        )
        .eq('company_id', companyId!)
        .order('created_at', {
          ascending: false,
        })

      return response?.data ?? []
    },
  })

  const { data: customers } = useQuery({
    queryKey: [
      'customers-select',
      companyId,
    ],

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

  /* ─────────────────────────────────────────────
     FORM
  ───────────────────────────────────────────── */

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),

    defaultValues: {
      service_name: '',
      description: '',
      status: 'pending',
      payment_status: 'pending',
      subtotal: 0,
      discount: 0,
      total: 0,
      notes: '',
      due_date: '',
      priority: 'normal',
    },
  })

  const subtotal = watch('subtotal')

  const discount = watch('discount')

  useEffect(() => {
    setValue(
      'total',
      Math.max(
        0,
        Number(subtotal) -
          Number(discount)
      )
    )
  }, [subtotal, discount, setValue])

  /* ─────────────────────────────────────────────
     SAVE
  ───────────────────────────────────────────── */

  const saveMutation = useMutation({
    mutationFn: async (
      data: FormData
    ) => {
      if (editingId) {
        const { error } = await (
          supabase.from('orders') as any
        )
          .update({
            ...data,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', editingId)

        if (error) throw error
      } else {
        const response: any = await (
          supabase.from('orders') as any
        )
          .insert([
            {
              ...data,
              company_id: companyId!,
              order_number: '',
            },
          ])
          .select()
          .single()

        const order = response?.data

        if (
          order &&
          data.payment_status === 'paid'
        ) {
          await (
            supabase.from(
              'transactions'
            ) as any
          ).insert([
            {
              company_id: companyId!,
              order_id: order.id,
              type: 'income',
              category: 'vendas',
              amount: data.total,
              description: `Pedido ${order.order_number}`,
              date: new Date().toISOString(),
            },
          ])
        }
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['orders', companyId],
      })

      queryClient.invalidateQueries({
        queryKey: ['dashboard', companyId],
      })

      setShowModal(false)

      reset()

      setEditingId(null)

      toast(
        'success',
        editingId
          ? 'Pedido atualizado!'
          : 'Pedido criado!'
      )
    },

    onError: (err: Error) => {
      console.error(
        '[pedidos] mutation error:',
        err
      )

      toast(
        'error',
        `Erro: ${err.message}`
      )
    },
  })

  /* ─────────────────────────────────────────────
     UPDATE STATUS
  ───────────────────────────────────────────── */

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: string
    }) => {
      await (
        supabase.from('orders') as any
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
        queryKey: ['orders', companyId],
      })

      toast(
        'success',
        'Status atualizado!'
      )
    },
  })

  /* ─────────────────────────────────────────────
     DELETE
  ───────────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await (
        supabase.from('orders') as any
      )
        .delete()
        .eq('id', id)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['orders', companyId],
      })

      toast(
        'success',
        'Pedido removido!'
      )
    },
  })

  /* ─────────────────────────────────────────────
     DND
  ───────────────────────────────────────────── */

  function handleDrop(
    e: React.DragEvent,
    newStatus: string
  ) {
    e.preventDefault()

    if (dragging) {
      updateStatus.mutate({
        id: dragging,
        status: newStatus,
      })

      setDragging(null)
    }
  }

  /* ─────────────────────────────────────────────
     FILTER
  ───────────────────────────────────────────── */

  const filtered =
    orders?.filter((o: any) => {
      const customerName =
        (
          o.customers as any
        )?.name
          ?.toString()
          ?.toLowerCase() ?? ''

      const serviceName =
        o.service_name
          ?.toLowerCase?.() ?? ''

      return (
        customerName.includes(
          search.toLowerCase()
        ) ||
        serviceName.includes(
          search.toLowerCase()
        )
      )
    }) ?? []

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */

  return (
    <div className="page-enter">

      <Header
        title="Pedidos"
        subtitle="Acompanhamento de produção"
      />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">

        {/* Toolbar */}

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">

          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />

            <input
              type="text"
              placeholder="Buscar pedidos..."
              className="input pl-9 w-64"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>

          <button
            onClick={() => {
              reset()

              setEditingId(null)

              setShowModal(true)
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Novo Pedido
          </button>
        </div>

        {/* Empty */}

        {isLoading ? (
          <div className="card">
            <SkeletonTable />
          </div>
        ) : orders?.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido"
            description="Crie seu primeiro pedido."
            action={{
              label: '+ Novo Pedido',
              onClick: () =>
                setShowModal(true),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

            {STATUS_COLUMNS.map((col) => {
              const colOrders =
                filtered.filter(
                  (o: any) =>
                    o.status === col.id
                )

              return (
                <div
                  key={col.id}
                  className={clsx(
                    'rounded-2xl border p-3 min-h-[300px]',
                    col.color
                  )}
                  onDragOver={(e) =>
                    e.preventDefault()
                  }
                  onDrop={(e) =>
                    handleDrop(
                      e,
                      col.id
                    )
                  }
                >
                  <div className="flex items-center justify-between mb-4">

                    <h3 className="font-semibold">
                      {col.label}
                    </h3>

                    <span className="badge badge-primary">
                      {colOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3">

                    {colOrders.map(
                      (order: any) => (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={() =>
                            setDragging(
                              order.id
                            )
                          }
                          className="bg-white dark:bg-surface-dark rounded-2xl p-4 shadow-card border border-border dark:border-border-dark"
                        >

                          <div className="flex justify-between items-start mb-3">

                            <div className="flex items-center gap-2">

                              <GripVertical
                                size={13}
                              />

                              <span className="text-xs font-semibold">
                                {
                                  order.order_number
                                }
                              </span>
                            </div>

                            <button
                              onClick={() =>
                                deleteMutation.mutate(
                                  order.id
                                )
                              }
                              className="text-text-muted hover:text-error"
                            >
                              <Trash2
                                size={14}
                              />
                            </button>
                          </div>

                          <h4 className="font-semibold text-sm">
                            {
                              order.service_name
                            }
                          </h4>

                          <p className="text-xs text-text-muted mt-1">
                            {
                              (
                                order.customers as any
                              )?.name
                            }
                          </p>

                          <div className="flex items-center justify-between mt-4">

                            <span className="font-bold text-primary">
                              {formatCurrency(
                                Number(
                                  order.total
                                )
                              )}
                            </span>

                            <span
                              className={clsx(
                                'badge text-[10px]',
                                order.payment_status ===
                                  'paid'
                                  ? 'badge-success'
                                  : 'badge-warning'
                              )}
                            >
                              {order.payment_status ===
                              'paid'
                                ? 'Pago'
                                : 'Pendente'}
                            </span>
                          </div>

                          {order.due_date && (
                            <div className="flex items-center gap-1 mt-3 text-[11px] text-text-muted">

                              <CalendarDays
                                size={12}
                              />

                              {format(
                                new Date(
                                  order.due_date
                                ),
                                'dd/MM/yyyy',
                                {
                                  locale:
                                    ptBR,
                                }
                              )}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() =>
              setShowModal(false)
            }
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-3xl shadow-modal w-full max-w-2xl max-h-[92vh] overflow-y-auto">

            {/* Header */}

            <div className="p-6 border-b border-border dark:border-border-dark flex items-center justify-between">

              <div>
                <h2 className="text-2xl font-bold">
                  Novo Pedido
                </h2>

                <p className="text-sm text-text-muted mt-1">
                  Cadastro rápido de produção
                </p>
              </div>

              <button
                onClick={() =>
                  setShowModal(false)
                }
                className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit((d) =>
                saveMutation.mutate(d)
              )}
              className="p-6 space-y-6"
            >

              {/* CLIENTE */}

              <div className="space-y-2">

                <label className="text-sm font-semibold flex items-center gap-2">
                  <User size={14} />
                  Cliente
                </label>

                <select
                  className="input h-12"
                  {...register(
                    'customer_id'
                  )}
                >
                  <option value="">
                    Selecione um cliente
                  </option>

                  {customers?.map(
                    (c: any) => (
                      <option
                        key={c.id}
                        value={c.id}
                      >
                        {c.name}
                      </option>
                    )
                  )}
                </select>

                {errors.customer_id && (
                  <p className="text-xs text-error">
                    {
                      errors
                        .customer_id
                        .message
                    }
                  </p>
                )}
              </div>

              {/* SERVIÇO */}

              <div className="space-y-2">

                <label className="text-sm font-semibold flex items-center gap-2">
                  <Package size={14} />
                  Produto / Serviço
                </label>

                <input
                  className="input h-12"
                  placeholder="Ex: Banner, Cartão, Adesivo..."
                  {...register(
                    'service_name'
                  )}
                />

                {errors.service_name && (
                  <p className="text-xs text-error">
                    {
                      errors
                        .service_name
                        .message
                    }
                  </p>
                )}
              </div>

              {/* DESCRIÇÃO */}

              <div className="space-y-2">

                <label className="text-sm font-semibold flex items-center gap-2">
                  <FileText size={14} />
                  Descrição do pedido
                </label>

                <textarea
                  rows={4}
                  className="input resize-none"
                  placeholder="Ex: 1000 cartões frente e verso..."
                  {...register(
                    'description'
                  )}
                />
              </div>

              {/* VALORES */}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign
                      size={14}
                    />
                    Valor
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    className="input h-12"
                    placeholder="0,00"
                    {...register(
                      'subtotal'
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    Desconto
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    className="input h-12"
                    placeholder="0,00"
                    {...register(
                      'discount'
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    Total Final
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    readOnly
                    className="input h-12 font-bold text-primary"
                    {...register(
                      'total'
                    )}
                  />
                </div>
              </div>

              {/* PRAZO */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="space-y-2">

                  <label className="text-sm font-semibold">
                    Prazo de entrega
                  </label>

                  <input
                    type="date"
                    className="input h-12"
                    {...register(
                      'due_date'
                    )}
                  />
                </div>

                <div className="space-y-2">

                  <label className="text-sm font-semibold">
                    Pagamento
                  </label>

                  <select
                    className="input h-12"
                    {...register(
                      'payment_status'
                    )}
                  >
                    <option value="pending">
                      Pendente
                    </option>

                    <option value="paid">
                      Pago
                    </option>
                  </select>
                </div>
              </div>

              {/* OBS */}

              <div className="space-y-2">

                <label className="text-sm font-semibold">
                  Observações internas
                </label>

                <textarea
                  rows={3}
                  className="input resize-none"
                  placeholder="Detalhes adicionais..."
                  {...register('notes')}
                />
              </div>

              {/* FOOTER */}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="btn-secondary flex-1 h-12"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saveMutation.isPending
                  }
                  className="btn-primary flex-1 h-12 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending && (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  )}

                  {saveMutation.isPending
                    ? 'Salvando...'
                    : 'Criar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
