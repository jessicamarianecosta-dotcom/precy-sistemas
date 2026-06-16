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
  Edit2,
  ChevronDown,
  CreditCard,
  Clock,
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

  priority:         z.string().default('normal'),
  payment_method:   z.string().optional(),
  signal_amount:    z.coerce.number().min(0).default(0),
  product_id:       z.string().optional(),
  order_date:       z.string().optional(),
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

  /* product picker */
  const [productSearch,     setProductSearch]     = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)

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

  /* produtos para o picker */
  const { data: productsList } = useQuery({
    queryKey: ['products-picker', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, final_price, category, description')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name')
      return data ?? []
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
      priority:        'normal',
      payment_method: '',
      signal_amount:  0,
      product_id:     '',
      order_date:     '',
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

  /* Campos válidos da tabela orders (após migration 004) */
  function buildOrderPayload(data: FormData) {
    // Colunas seguras — existem na tabela orders atual.
    // order_date / remaining_amount / product_id precisam da migration 004.
    return {
      customer_id:    data.customer_id,
      service_name:   data.service_name   || '',
      description:    data.description    || null,
      status:         data.status         || 'pending',
      payment_status: data.payment_status || 'pending',
      payment_method: data.payment_method || null,
      subtotal:       Number(data.subtotal)      || 0,
      discount:       Number(data.discount)      || 0,
      total:          Number(data.total)         || 0,
      signal_amount:  Number(data.signal_amount) || 0,
      notes:          data.notes           || null,
      due_date:       data.due_date        || null,
      priority:       data.priority        || 'normal',
    }
  }

  async function ensureFinancialTransaction(
    orderId: string,
    orderNumber: string,
    data: FormData,
    prevPaymentStatus?: string
  ) {
    const amount = data.payment_status === 'partial'
      ? Number(data.signal_amount) || 0
      : Number(data.total) || 0

    if (amount <= 0) return
    if (data.payment_status !== 'paid' && data.payment_status !== 'partial') return
    if (prevPaymentStatus === data.payment_status) return // sem mudança

    // Verificar se já existe lançamento para este pedido
    const { data: existing } = await (supabase.from('financial_transactions') as any)
      .select('id, amount')
      .eq('order_id', orderId)
      .eq('company_id', companyId!)
      .maybeSingle()

    if (existing?.id) {
      // Atualizar valor se mudou
      if (Number(existing.amount) !== amount) {
        await (supabase.from('financial_transactions') as any)
          .update({ amount, description: `Pedido ${orderNumber} — ${data.service_name}`, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      }
      return
    }

    // Criar novo lançamento
    await (supabase.from('financial_transactions') as any).insert([{
      company_id:  companyId!,
      order_id:    orderId,
      type:        'income',
      category:    'vendas',
      amount,
      description: `Pedido ${orderNumber} — ${data.service_name || 'Serviço'}`,
      date:        new Date().toISOString().split('T')[0],
    }])
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = buildOrderPayload(data)

      if (editingId) {
        // Pegar status anterior para evitar duplicar lançamento
        const prev = (orders ?? []).find((o: Record<string, unknown>) => o.id === editingId) as Record<string, unknown> | undefined
        const prevPaymentStatus = (prev?.payment_status as string) ?? ''

        const { error } = await (supabase.from('orders') as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) { console.error('[pedidos] update error:', error); throw new Error(error.message) }

        // Integração financeira automática
        await ensureFinancialTransaction(editingId, (prev?.order_number as string) ?? '', data, prevPaymentStatus)
      } else {
        const { data: order, error } = await (supabase.from('orders') as any)
          .insert([{ ...payload, company_id: companyId!, order_number: '' }])
          .select('id, order_number')
          .single()
        if (error) { console.error('[pedidos] insert error:', error); throw new Error(error.message) }

        // Integração financeira automática
        if (order?.id) {
          await ensureFinancialTransaction(order.id, order.order_number ?? '', data, '')
        }
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] })

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

  /* ── Abrir pedido para edição ── */
  function openOrder(order: Record<string, unknown>) {
    setEditingId(order.id as string)
    const fields = [
      'customer_id','service_name','description','status',
      'payment_status','subtotal','discount','total','notes',
      'due_date','priority','payment_method','signal_amount',
      'product_id','order_date',
    ]
    fields.forEach(k => {
      const val = order[k]
      if (val !== undefined && val !== null) {
        setValue(k as never, val as never)
      }
    })
    setShowModal(true)
  }

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
          <>
            {/* ── MOBILE: Lista de pedidos ── */}
            <div className="sm:hidden space-y-2">
              {filtered.map((order: any) => (
                <div key={order.id}
                  className="card p-0 overflow-hidden"
                  onClick={() => openOrder(order)}
                >
                  <div className="flex items-start gap-3 p-3.5">
                    <div className={clsx(
                      'w-2 self-stretch rounded-full flex-shrink-0',
                      order.status === 'production' ? 'bg-blue-400'
                        : order.status === 'ready'      ? 'bg-green-400'
                        : order.status === 'delivered'  ? 'bg-primary'
                        : 'bg-stone-300 dark:bg-stone-600'
                    )}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100 truncate">
                            {order.service_name || '—'}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {order.customers?.name || 'Sem cliente'} · {order.order_number || ''}
                          </p>
                          {(order as any).quote_id && (
                            <a href="/orcamentos" className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-primary hover:opacity-80">
                              <FileText size={9}/> Do orçamento
                            </a>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-primary">{formatCurrency(Number(order.total))}</p>
                          <span className={clsx(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            order.payment_status === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                          )}>
                            {order.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                      {order.due_date && (
                        <div className="flex items-center gap-1 mt-2 text-[11px] text-text-muted">
                          <CalendarDays size={11}/>
                          {format(new Date(order.due_date), 'dd/MM/yyyy', {locale: ptBR})}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openOrder(order) }}
                      className="p-1.5 rounded-xl text-text-muted hover:text-primary hover:bg-primary-50 flex-shrink-0 self-center"
                    >
                      <Edit2 size={13}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── DESKTOP: Kanban ── */}
          <div className="hidden sm:grid grid-cols-2 xl:grid-cols-4 gap-3">

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
                          onDragStart={() => setDragging(order.id)}
                          className={clsx(
                            "group bg-white dark:bg-surface-dark rounded-2xl p-3.5 shadow-card border transition-all cursor-grab active:cursor-grabbing",
                            dragging === order.id
                              ? "border-primary/40 shadow-[0_0_0_2px_rgba(139,108,79,0.15)] scale-[0.98] opacity-70"
                              : "border-border dark:border-border-dark hover:border-primary/30 hover:shadow-md"
                          )}
                        >
                          {/* Row 1: number + actions */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <GripVertical size={12} className="text-text-muted/50 flex-shrink-0"/>
                              <span className="text-[10px] font-mono text-text-muted">{order.order_number||'—'}</span>
                              {(order as any).quote_id && (
                                <a href="/orcamentos" className="inline-flex items-center gap-0.5 text-[9px] font-medium text-primary hover:opacity-80" title="Originado de orçamento">
                                  <FileText size={9}/> ORC
                                </a>
                              )}
                              {(order as any).priority === 'urgent' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">URGENTE</span>
                              )}
                              {(order as any).priority === 'high' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">ALTA</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); openOrder(order); }}
                                className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"
                                title="Editar pedido"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(order.id); }}
                                className="p-1 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: service name */}
                          <p className="font-semibold text-sm text-text-primary dark:text-stone-100 leading-tight truncate">
                            {(order as any).service_name || '—'}
                          </p>

                          {/* Row 3: client */}
                          <div className="flex items-center gap-1 mt-1">
                            <User size={10} className="text-text-muted flex-shrink-0"/>
                            <p className="text-[11px] text-text-muted truncate">
                              {(order.customers as any)?.name || 'Sem cliente'}
                            </p>
                          </div>

                          {/* Row 4: value + payment badge */}
                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50 dark:border-border-dark/50">
                            <span className="font-bold text-sm text-primary">
                              {formatCurrency(Number(order.total))}
                            </span>
                            <span className={clsx(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                              (order as any).payment_status === 'paid'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : (order as any).payment_status === 'partial'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                            )}>
                              {(order as any).payment_status === 'paid' ? 'Pago'
                                : (order as any).payment_status === 'partial' ? 'Parcial'
                                : 'Pendente'}
                            </span>
                          </div>

                          {/* Row 5: due date + method */}
                          <div className="flex items-center justify-between mt-1.5">
                            {(order as any).due_date ? (
                              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                                <CalendarDays size={10}/>
                                {format(new Date((order as any).due_date), 'dd/MM/yyyy', {locale: ptBR})}
                              </div>
                            ) : <span/>}
                            {(order as any).payment_method && (
                              <span className="text-[10px] text-text-muted/70 uppercase tracking-wide">
                                {(order as any).payment_method === 'pix' ? 'PIX'
                                  : (order as any).payment_method === 'cartao_credito' ? 'Crédito'
                                  : (order as any).payment_method === 'cartao_debito' ? 'Débito'
                                  : (order as any).payment_method}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════
          MODAL NOVO / EDITAR PEDIDO
      ══════════════════════════════════ */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowModal(false); setShowProductPicker(false) }} />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-2xl max-h-[95dvh] sm:max-h-[92vh] flex flex-col animate-scaleIn overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-text-primary dark:text-stone-100">
                  {editingId ? 'Editar Pedido' : 'Novo Pedido'}
                </h2>
                {editingId && (
                  <p className="text-xs text-text-muted dark:text-stone-500 mt-0.5">
                    Altere os campos e salve para atualizar.
                  </p>
                )}
              </div>
              <button onClick={() => { setShowModal(false); reset(); setEditingId(null); setShowProductPicker(false) }}
                className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={16} />
              </button>
            </div>

            {/* Body scrollable */}
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-5 space-y-5">

                {/* ── S1: Cliente ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <User size={12} /> Cliente
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Cliente *</label>
                      <select className="input" {...register('customer_id')}>
                        <option value="">Selecione um cliente...</option>
                        {(customers ?? []).map((c: Record<string, string>) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {errors.customer_id && <p className="mt-1 text-xs text-error">{errors.customer_id.message}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Observações do cliente</label>
                      <textarea rows={2} className="input resize-none" placeholder="Preferências, instruções especiais..." {...register('notes')} />
                    </div>
                  </div>
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S2: Produto / Serviço ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <Package size={12} /> Produto / Serviço
                  </h3>

                  {/* Product picker */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                      Nome do produto / serviço *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="input pr-9"
                        placeholder="Buscar nos cadastrados ou digitar manualmente..."
                        {...register('service_name')}
                        onFocus={() => setShowProductPicker(true)}
                        onChange={e => {
                          setProductSearch(e.target.value)
                          register('service_name').onChange(e)
                        }}
                        autoComplete="off"
                      />
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />

                      {showProductPicker && (
                        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-modal max-h-48 overflow-y-auto">
                          {(productsList ?? [])
                            .filter((p: Record<string, unknown>) =>
                              productSearch === '' ||
                              (p.name as string).toLowerCase().includes(productSearch.toLowerCase())
                            )
                            .slice(0, 8)
                            .map((p: Record<string, unknown>) => (
                              <button
                                key={p.id as string}
                                type="button"
                                className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary/10 flex items-center justify-between gap-3 border-b border-border dark:border-border-dark last:border-0 transition-colors"
                                onClick={() => {
                                  setValue('service_name', p.name as string)
                                  setValue('product_id',   p.id   as string)
                                  setValue('subtotal',     Number(p.final_price) || 0)
                                  setValue('total',        Number(p.final_price) || 0)
                                  if (p.description) setValue('description', p.description as string)
                                  setProductSearch(p.name as string)
                                  setShowProductPicker(false)
                                }}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{p.name as string}</p>
                                  <p className="text-[10px] text-text-muted dark:text-stone-500">{p.category as string}</p>
                                </div>
                                <span className="text-sm font-bold text-primary flex-shrink-0">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.final_price))}
                                </span>
                              </button>
                            ))}
                          {(productsList ?? []).length === 0 && (
                            <p className="text-xs text-text-muted dark:text-stone-500 text-center py-3">Nenhum produto cadastrado</p>
                          )}
                          <div className="px-3 py-2 bg-primary-50/50 dark:bg-primary/5">
                            <p className="text-[10px] text-text-muted dark:text-stone-500">💡 Ou continue digitando para inserir manualmente</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.service_name && <p className="mt-1 text-xs text-error">{errors.service_name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Descrição do pedido</label>
                    <textarea rows={2} className="input resize-none" placeholder="Detalhes, especificações, cores..." {...register('description')} />
                  </div>
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S3: Valores ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <DollarSign size={12} /> Valores
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Subtotal (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" placeholder="0,00" {...register('subtotal')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Desconto (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" placeholder="0,00" {...register('discount')} />
                    </div>
                  </div>
                  {/* Total calculado automaticamente */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                    <span className="text-sm font-medium text-text-secondary dark:text-stone-400">Total final</span>
                    <span className="text-xl font-bold text-primary">
                      {new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(
                        Math.max(0, Number(watch('subtotal') || 0) - Number(watch('discount') || 0))
                      )}
                    </span>
                  </div>
                  <input type="hidden" {...register('total')} />
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S4 + S5: Prazos e Status ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <Clock size={12} /> Prazos &amp; Status
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Data do pedido</label>
                      <input type="date" className="input" {...register('order_date')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Prazo de entrega</label>
                      <input type="date" className="input" {...register('due_date')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Status</label>
                      <select className="input" {...register('status')}>
                        <option value="pending">Pendente</option>
                        <option value="production">Produção</option>
                        <option value="ready">Pronto</option>
                        <option value="delivered">Entregue</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Prioridade</label>
                      <select className="input" {...register('priority')}>
                        <option value="low">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S6: Pagamento ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <CreditCard size={12} /> Pagamento
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Status pagamento</label>
                      <select className="input" {...register('payment_status')}>
                        <option value="pending">Pendente</option>
                        <option value="partial">Parcial</option>
                        <option value="paid">Pago</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Forma de pagamento</label>
                      <select className="input" {...register('payment_method')}>
                        <option value="">Selecionar...</option>
                        <option value="pix">PIX</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao_credito">Cartão Crédito</option>
                        <option value="cartao_debito">Cartão Débito</option>
                        <option value="transferencia">Transferência</option>
                        <option value="boleto">Boleto</option>
                        <option value="parcelado">Parcelado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Sinal recebido (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" placeholder="0,00" {...register('signal_amount')} />
                      {(() => {
                        const sig   = Number(watch('signal_amount') || 0)
                        const total = Number(watch('total') || 0)
                        const rest  = Math.max(0, total - sig)
                        return sig > 0 ? (
                          <p className="mt-1 text-[10px] text-text-muted dark:text-stone-500">
                            Restante: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rest)}
                          </p>
                        ) : null
                      })()}
                    </div>
                  </div>
                </section>

                {/* ── S7: Anexos (estrutura futura) ── */}
                <section className="rounded-xl border border-dashed border-border dark:border-border-dark p-4 text-center">
                  <FileText size={20} className="text-text-muted mx-auto mb-2" />
                  <p className="text-xs font-medium text-text-secondary dark:text-stone-400">Anexos</p>
                  <p className="text-[10px] text-text-muted dark:text-stone-500 mt-0.5">Upload de arte, PDF e imagens — em breve</p>
                </section>

              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark bg-white dark:bg-surface-dark sticky bottom-0">
                <button type="button" onClick={() => { setShowModal(false); reset(); setEditingId(null) }}
                  className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
