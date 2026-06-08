'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
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
} from 'lucide-react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_COLUMNS = [
  {
    id: 'pending',
    label: 'Pendente',
    color:
      'bg-warning-light dark:bg-warning/10 border-warning/20',
    dot: 'bg-warning',
    text: 'text-warning-dark',
  },

  {
    id: 'production',
    label: 'Em Produção',
    color:
      'bg-info-light dark:bg-info/10 border-info/20',
    dot: 'bg-info',
    text: 'text-info-dark',
  },

  {
    id: 'ready',
    label: 'Pronto',
    color:
      'bg-success-light dark:bg-success/10 border-success/20',
    dot: 'bg-success',
    text: 'text-success-dark',
  },

  {
    id: 'delivered',
    label: 'Entregue',
    color:
      'bg-primary-50 dark:bg-primary/10 border-primary/20',
    dot: 'bg-primary',
    text: 'text-primary',
  },
]

const schema = z.object({
  customer_id: z.string().min(
    1,
    'Selecione um cliente'
  ),

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
})

type FormData = z.infer<typeof schema>

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v)
}

export default function PedidosPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [companyId, setCompanyId] =
    useState<string | null>(null)

  const [showModal, setShowModal] =
    useState(false)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [view, setView] = useState<
    'kanban' | 'list'
  >('kanban')

  const [search, setSearch] =
    useState('')

  const [dragging, setDragging] =
    useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const response: any = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single()

      const company = response?.data

      if (company?.id) {
        setCompanyId(company.id)
      }
    }

    load()
  }, [])

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
      status: 'pending',
      payment_status: 'pending',
      subtotal: 0,
      discount: 0,
      total: 0,
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

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (editingId) {
        await (
          supabase.from('orders') as any
        )
          .update({
            ...data,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', editingId)
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

      queryClient.invalidateQueries({
        queryKey: ['dashboard', companyId],
      })
    },
  })

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

      queryClient.invalidateQueries({
        queryKey: ['dashboard', companyId],
      })
    },
  })

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

  const filtered =
    orders?.filter((o: any) => {
      const customerName =
        (
          o.customers as any
        )?.name
          ?.toString()
          ?.toLowerCase() ?? ''

      const orderNumber =
        o.order_number
          ?.toLowerCase?.() ?? ''

      return (
        customerName.includes(
          search.toLowerCase()
        ) ||
        orderNumber.includes(
          search.toLowerCase()
        )
      )
    }) ?? []

  return (
    <div className="page-enter">
      <Header
        title="Pedidos"
        subtitle="Kanban e acompanhamento de pedidos"
      />

      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />

              <input
                type="text"
                placeholder="Buscar pedidos..."
                className="input pl-9 w-56"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />
            </div>
          </div>

          <button
            onClick={() => {
              reset()

              setEditingId(null)

              setShowModal(true)
            }}
            className="btn-primary flex items-center gap-2 flex-shrink-0"
          >
            <Plus size={16} />
            Novo Pedido
          </button>
        </div>

        {isLoading ? (
          <div className="card">
            <SkeletonTable />
          </div>
        ) : orders?.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido ainda"
            description="Crie seu primeiro pedido e acompanhe via Kanban."
            action={{
              label: '+ Novo Pedido',
              onClick: () =>
                setShowModal(true),
            }}
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
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
                    'rounded-2xl border p-3 min-h-[400px]',
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
                  <div className="space-y-2.5">
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
                          className="bg-white dark:bg-surface-dark rounded-xl p-3 shadow-card"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <GripVertical size={12} />

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
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <p className="text-sm font-medium">
                            {
                              (
                                order.customers as any
                              )?.name
                            }
                          </p>

                          <div className="flex items-center justify-between mt-2">
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
                            <p className="text-[10px] mt-1">
                              📅{' '}
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
                            </p>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() =>
              setShowModal(false)
            }
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Novo Pedido
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
              className="p-6 space-y-4"
            >
              <select
                className="input"
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

              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="Subtotal"
                {...register(
                  'subtotal'
                )}
              />

              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="Desconto"
                {...register(
                  'discount'
                )}
              />

              <input
                type="number"
                step="0.01"
                className="input"
                readOnly
                {...register('total')}
              />

              <textarea
                className="input resize-none"
                placeholder="Observações"
                {...register('notes')}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
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
