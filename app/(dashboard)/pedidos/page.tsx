'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ShoppingCart, Plus, Search, X, Loader2, GripVertical, Edit2, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_COLUMNS = [
  { id: 'pending', label: 'Pendente', color: 'bg-warning-light dark:bg-warning/10 border-warning/20', dot: 'bg-warning', text: 'text-warning-dark' },
  { id: 'production', label: 'Em Produção', color: 'bg-info-light dark:bg-info/10 border-info/20', dot: 'bg-info', text: 'text-info-dark' },
  { id: 'ready', label: 'Pronto', color: 'bg-success-light dark:bg-success/10 border-success/20', dot: 'bg-success', text: 'text-success-dark' },
  { id: 'delivered', label: 'Entregue', color: 'bg-primary-50 dark:bg-primary/10 border-primary/20', dot: 'bg-primary', text: 'text-primary' },
]

const schema = z.object({
  customer_id: z.string().min(1, 'Selecione um cliente'),
  status: z.string().default('pending'),
  payment_status: z.string().default('pending'),
  subtotal: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
  notes: z.string().optional(),
  due_date: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function PedidosPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).single()
      if (company) setCompanyId(company.id)
    }
    load()
  }, [])

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, customers(name, phone)')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: customers } = useQuery({
    queryKey: ['customers-select', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, name').eq('company_id', companyId!).order('name')
      return data ?? []
    },
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'pending', payment_status: 'pending', subtotal: 0, discount: 0, total: 0 }
  })

  const subtotal = watch('subtotal')
  const discount = watch('discount')
  useEffect(() => { setValue('total', Math.max(0, subtotal - discount)) }, [subtotal, discount])

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (editingId) {
        await supabase.from('orders').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingId)
      } else {
        const { data: order } = await supabase
          .from('orders').insert({ ...data, company_id: companyId!, order_number: '' }).select().single()
        // Auto-register as transaction
        if (order && data.payment_status === 'paid') {
          await supabase.from('transactions').insert({
            company_id: companyId!,
            order_id: order.id,
            type: 'income',
            category: 'vendas',
            amount: data.total,
            description: `Pedido ${order.order_number}`,
            date: new Date().toISOString(),
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      setShowModal(false); reset(); setEditingId(null)
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('orders').delete().eq('id', id) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
    },
  })

  function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault()
    if (dragging) {
      updateStatus.mutate({ id: dragging, status: newStatus })
      setDragging(null)
    }
  }

  const filtered = orders?.filter(o =>
    (o.customers as Record<string, unknown>)?.name?.toString().toLowerCase().includes(search.toLowerCase()) ||
    o.order_number.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <div className="page-enter">
      <Header title="Pedidos" subtitle="Kanban e acompanhamento de pedidos" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" placeholder="Buscar pedidos..." className="input pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex border border-border dark:border-border-dark rounded-xl overflow-hidden">
              {(['kanban', 'list'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} className={clsx('px-3 py-2 text-xs font-medium transition-colors capitalize', view === v ? 'bg-primary text-white' : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5')}>
                  {v === 'kanban' ? '⬛ Kanban' : '☰ Lista'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { reset(); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 flex-shrink-0">
            <Plus size={16} /> Novo Pedido
          </button>
        </div>

        {isLoading ? (
          <div className="card"><SkeletonTable /></div>
        ) : orders?.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido ainda"
            description="Crie seu primeiro pedido e acompanhe via Kanban."
            action={{ label: '+ Novo Pedido', onClick: () => setShowModal(true) }}
          />
        ) : view === 'kanban' ? (
          // KANBAN VIEW
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
            {STATUS_COLUMNS.map(col => {
              const colOrders = filtered.filter(o => o.status === col.id)
              return (
                <div
                  key={col.id}
                  className={clsx('rounded-2xl border p-3 min-h-[400px]', col.color)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, col.id)}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className={clsx('w-2 h-2 rounded-full', col.dot)} />
                      <span className={clsx('text-xs font-semibold', col.text)}>{col.label}</span>
                    </div>
                    <span className="bg-white dark:bg-black/20 text-xs font-bold px-2 py-0.5 rounded-full text-text-secondary dark:text-stone-400">
                      {colOrders.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {colOrders.map(order => (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={() => setDragging(order.id)}
                        className="bg-white dark:bg-surface-dark rounded-xl p-3 shadow-card cursor-grab active:cursor-grabbing group hover:shadow-card-hover transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GripVertical size={12} className="text-text-muted flex-shrink-0" />
                            <span className="text-xs font-semibold text-text-muted truncate">{order.order_number}</span>
                          </div>
                          <button
                            onClick={() => deleteMutation.mutate(order.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-error transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100 mb-2 truncate">
                          {(order.customers as Record<string, unknown>)?.name as string}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-primary">{formatCurrency(order.total)}</span>
                          <span className={clsx('badge text-[10px]', order.payment_status === 'paid' ? 'badge-success' : order.payment_status === 'overdue' ? 'badge-error' : 'badge-warning')}>
                            {order.payment_status === 'paid' ? 'Pago' : order.payment_status === 'overdue' ? 'Atrasado' : 'Pendente'}
                          </span>
                        </div>
                        {order.due_date && (
                          <p className="text-[10px] text-text-muted mt-1.5">
                            📅 {format(new Date(order.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    ))}
                    {colOrders.length === 0 && (
                      <div className="text-center py-6 text-xs text-text-muted">
                        Arraste pedidos aqui
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // LIST VIEW
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    {['Pedido', 'Cliente', 'Status', 'Pagamento', 'Total', 'Vencimento', 'Ações'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => (
                    <tr key={order.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-sm font-medium text-text-primary dark:text-stone-100">{order.order_number}</td>
                      <td className="p-4 text-sm text-text-secondary dark:text-stone-300">{(order.customers as Record<string, unknown>)?.name as string}</td>
                      <td className="p-4">
                        <span className={clsx('badge',
                          order.status === 'pending' ? 'badge-warning' :
                          order.status === 'production' ? 'badge-info' :
                          order.status === 'ready' ? 'badge-success' : 'badge-primary'
                        )}>
                          {STATUS_COLUMNS.find(c => c.id === order.status)?.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={clsx('badge', order.payment_status === 'paid' ? 'badge-success' : order.payment_status === 'overdue' ? 'badge-error' : 'badge-warning')}>
                          {order.payment_status === 'paid' ? 'Pago' : order.payment_status === 'overdue' ? 'Atrasado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-primary">{formatCurrency(order.total)}</td>
                      <td className="p-4 text-sm text-text-secondary dark:text-stone-300">
                        {order.due_date ? format(new Date(order.due_date), 'dd/MM/yy') : '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1.5">
                          <button onClick={() => deleteMutation.mutate(order.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-surface-dark p-6 pb-4 border-b border-border dark:border-border-dark rounded-t-2xl z-10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">Novo Pedido</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-primary-50 text-text-muted"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Cliente *</label>
                  <select className="input" {...register('customer_id')}>
                    <option value="">Selecione um cliente</option>
                    {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {errors.customer_id && <p className="mt-1 text-xs text-error">{errors.customer_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Status</label>
                  <select className="input" {...register('status')}>
                    <option value="pending">Pendente</option>
                    <option value="production">Em Produção</option>
                    <option value="ready">Pronto</option>
                    <option value="delivered">Entregue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Pagamento</label>
                  <select className="input" {...register('payment_status')}>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Atrasado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Subtotal (R$)</label>
                  <input type="number" step="0.01" className="input" placeholder="0,00" {...register('subtotal')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Desconto (R$)</label>
                  <input type="number" step="0.01" className="input" placeholder="0,00" {...register('discount')} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Total (R$)</label>
                  <input type="number" step="0.01" className="input bg-primary-50 dark:bg-primary/10 font-bold" readOnly {...register('total')} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Data de Entrega</label>
                  <input type="date" className="input" {...register('due_date')} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Observações</label>
                  <textarea rows={2} className="input resize-none" {...register('notes')} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : 'Criar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
