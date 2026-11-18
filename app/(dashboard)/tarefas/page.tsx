'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import {
  ListChecks,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  Circle,
  CalendarDays,
  ShoppingCart,
  User,
} from 'lucide-react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/* ─────────────────────────────────────────────
   Tarefas — lista simples de pendências do dia a dia, com link opcional
   para um pedido ou cliente. Diferente da Agenda (que é um calendário
   mensal com pedidos + tarefas por data), Tarefas é uma lista única,
   ordenável por prioridade/data, para o "o que eu preciso fazer hoje".

   Tabela `tasks` (Fase 7 do projeto Precy Essencial): tabela antes órfã
   (precyflow_tasks, usava store_id em vez de company_id) — corrigida e
   renomeada nesta fase para ser multi-tenant de verdade.
───────────────────────────────────────────── */

const schema = z.object({
  title:       z.string().min(2, 'Título obrigatório'),
  due_date:    z.string().optional(),
  priority:    z.enum(['baixa', 'media', 'alta']).default('media'),
  customer_id: z.string().optional(),
  order_id:    z.string().optional(),
})

type FormData = z.infer<typeof schema>

const PRIORITY_CFG = {
  baixa: { label: 'Baixa', badge: 'badge-primary' },
  media: { label: 'Média', badge: 'badge-warning' },
  alta:  { label: 'Alta',  badge: 'badge-error'   },
}

export default function TarefasPage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { companyId } = useCompanyId()

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'aberta' | 'concluida'>('aberta')

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('tasks') as any)
        .select('*, customers(name), orders(order_number)')
        .eq('company_id', companyId!)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  // Listas curtas para os selects de vínculo — mesma lógica usada na Agenda.
  const { data: customers } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['tasks-customers', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('customers') as any)
        .select('id, name').eq('company_id', companyId!).order('name')
      return data ?? []
    },
  })

  const { data: orders } = useQuery<{ id: string; order_number: string }[]>({
    queryKey: ['tasks-orders', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('orders') as any)
        .select('id, order_number').eq('company_id', companyId!).order('created_at', { ascending: false }).limit(200)
      return data ?? []
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'media' },
  })

  const saveMutation = useMutation({
    mutationFn: async (d: FormData) => {
      const payload = {
        title:       d.title,
        due_date:    d.due_date || null,
        priority:    d.priority,
        customer_id: d.customer_id || null,
        order_id:    d.order_id || null,
      }
      if (editingId) {
        const { error } = await (supabase.from('tasks') as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('tasks') as any)
          .insert([{ ...payload, company_id: companyId! }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId] })
      toast('success', editingId ? 'Tarefa atualizada!' : 'Tarefa criada!')
      closeModal()
    },
    onError: (err: Error) => {
      console.error('[tarefas] save error:', err)
      toast('error', `Erro ao salvar: ${err.message}`)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'aberta' | 'concluida' }) => {
      const { error } = await (supabase.from('tasks') as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['tasks', companyId] })
      qc.setQueryData(['tasks', companyId], (old: any[] | undefined) =>
        (old ?? []).map(t => (t.id === id ? { ...t, status } : t))
      )
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId] })
      toast('error', 'Erro ao atualizar a tarefa.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('tasks') as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId] })
      toast('success', 'Tarefa removida.')
      setDeleteId(null)
    },
    onError: (err: Error) => {
      toast('error', `Erro ao excluir: ${err.message}`)
    },
  })

  function openEdit(task: Record<string, any>) {
    setEditingId(task.id)
    setValue('title', task.title || '')
    setValue('due_date', task.due_date || '')
    setValue('priority', task.priority || 'media')
    setValue('customer_id', task.customer_id || '')
    setValue('order_id', task.order_id || '')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    reset()
    setEditingId(null)
  }

  const filtered = (tasks ?? []).filter((t: Record<string, any>) => {
    const matchSearch = (t.title || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    return matchSearch && matchStatus
  })

  const abertasCount = (tasks ?? []).filter((t: Record<string, any>) => t.status === 'aberta').length

  return (
    <div className="page-enter">
      <Header title="Tarefas" subtitle="Suas pendências do dia a dia" />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap flex-1 min-w-0">
            <div className="relative flex-1 sm:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar tarefa..."
                className="input pl-9 w-full sm:w-52"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select className="input w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
              <option value="aberta">Abertas ({abertasCount})</option>
              <option value="concluida">Concluídas</option>
              <option value="all">Todas</option>
            </select>
          </div>

          <button
            onClick={() => { reset(); setEditingId(null); setShowModal(true) }}
            className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto"
          >
            <Plus size={16} />
            Nova Tarefa
          </button>
        </div>

        {/* Lista */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={filterStatus === 'concluida' ? 'Nenhuma tarefa concluída' : 'Nenhuma tarefa pendente'}
              description="Cadastre o que você precisa fazer e acompanhe por aqui."
              action={{ label: '+ Nova Tarefa', onClick: () => setShowModal(true) }}
            />
          ) : (
            <div className="divide-y divide-border dark:divide-border-dark">
              {filtered.map((task: Record<string, any>) => {
                const done = task.status === 'concluida'
                const pCfg = PRIORITY_CFG[task.priority as keyof typeof PRIORITY_CFG] ?? PRIORITY_CFG.media
                return (
                  <div key={task.id} className="p-4 flex items-start gap-3">
                    <button
                      onClick={() => toggleMutation.mutate({ id: task.id, status: done ? 'aberta' : 'concluida' })}
                      className="mt-0.5 flex-shrink-0 text-text-muted hover:text-primary transition-colors"
                      title={done ? 'Reabrir tarefa' : 'Concluir tarefa'}
                    >
                      {done ? <CheckCircle2 size={20} className="text-success" /> : <Circle size={20} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm font-medium text-text-primary dark:text-stone-100', done && 'line-through text-text-muted dark:text-stone-500')}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={clsx('badge text-[10px]', pCfg.badge)}>{pCfg.label}</span>
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-[11px] text-text-muted">
                            <CalendarDays size={11} />
                            {format(new Date(task.due_date + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })}
                          </span>
                        )}
                        {task.customers?.name && (
                          <span className="flex items-center gap-1 text-[11px] text-text-muted">
                            <User size={11} /> {task.customers.name}
                          </span>
                        )}
                        {task.orders?.order_number && (
                          <span className="flex items-center gap-1 text-[11px] text-text-muted">
                            <ShoppingCart size={11} /> {task.orders.order_number}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(task)}
                        className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-primary-50 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(task.id)}
                        className="p-2 rounded-xl text-text-muted hover:text-error hover:bg-error-light transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg animate-scaleIn max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-border dark:border-border-dark flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">
                {editingId ? 'Editar Tarefa' : 'Nova Tarefa'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={16} />
              </button>
            </div>

            <form id="tarefas-form" onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                  O que precisa ser feito? *
                </label>
                <input className="input" placeholder="Ex: Ligar para fornecedor sobre o pedido de MDF" {...register('title')} />
                {errors.title && <p className="mt-1 text-xs text-error">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Prazo
                  </label>
                  <input type="date" className="input" {...register('due_date')} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Prioridade
                  </label>
                  <select className="input" {...register('priority')}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Vincular a cliente
                  </label>
                  <select className="input" {...register('customer_id')}>
                    <option value="">Nenhum</option>
                    {(customers ?? []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Vincular a pedido
                  </label>
                  <select className="input" {...register('order_id')}>
                    <option value="">Nenhum</option>
                    {(orders ?? []).map(o => (
                      <option key={o.id} value={o.id}>{o.order_number}</option>
                    ))}
                  </select>
                </div>
              </div>
            </form>

            <div className="flex flex-col sm:flex-row gap-3 p-6 pt-4 border-t border-border dark:border-border-dark flex-shrink-0">
              <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" form="tarefas-form" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
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
            <h3 className="text-base font-semibold mb-2 text-text-primary dark:text-stone-100">Remover esta tarefa?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
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
