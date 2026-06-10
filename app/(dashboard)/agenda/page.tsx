'use client'

import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { clsx } from 'clsx'
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2,
  Package, CalendarDays, Clock, Flag, Tag,
  CheckCircle2, Circle, AlertCircle, Trash2, Edit3,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
         addMonths, subMonths, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/* ── Types ─────────────────────────────── */
interface CalTask {
  id:              string
  company_id:      string
  title:           string
  description?:    string | null
  date:            string
  time?:           string | null
  priority:        'low' | 'normal' | 'high' | 'urgent'
  category:        string
  status:          'pending' | 'in_progress' | 'done'
  notes?:          string | null
  linked_order_id?: string | null
}

interface Order {
  id:           string
  order_number: string
  service_name: string
  due_date:     string
  status:       string
  total:        number
  priority?:    string
  customers?:   { name: string } | null
}

type FilterType = 'all' | 'orders' | 'tasks'

/* ── Constants ─────────────────────────── */
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  task:       { label: 'Tarefa',      emoji: '✏️',  color: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'  },
  production: { label: 'Produção',    emoji: '🏭',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'   },
  delivery:   { label: 'Entrega',     emoji: '🚚',  color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'},
  meeting:    { label: 'Reunião',     emoji: '👥',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  financial:  { label: 'Financeiro',  emoji: '💰',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  personal:   { label: 'Pessoal',     emoji: '⭐',  color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'   },
  reminder:   { label: 'Lembrete',    emoji: '🔔',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
}

const ORDER_STATUS_COLOR: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  production: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  ready:      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800',
  delivered:  'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 border-stone-200 dark:border-stone-700',
}

const PRIORITY_CONFIG = {
  low:    { label: 'Baixa',    color: 'text-stone-400', dot: 'bg-stone-400'   },
  normal: { label: 'Normal',   color: 'text-blue-500',  dot: 'bg-blue-500'    },
  high:   { label: 'Alta',     color: 'text-amber-500', dot: 'bg-amber-500'   },
  urgent: { label: 'Urgente',  color: 'text-red-500',   dot: 'bg-red-500'     },
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

/* ══════════════════════════════════════════
   PAGE
══════════════════════════════════════════ */
export default function AgendaPage() {
  const supabase    = createClient()
  const qc          = useQueryClient()
  const { toast }   = useToast()
  const { companyId } = useCompanyId()

  /* ── State ── */
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filter,      setFilter]      = useState<FilterType>('all')
  const [showModal,   setShowModal]   = useState(false)
  const [editTask,    setEditTask]    = useState<CalTask | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const panelRef = useRef<HTMLDivElement>(null)
  const [viewEvent,   setViewEvent]   = useState<{ type: 'task' | 'order'; data: CalTask | Order } | null>(null)
  const [saving,      setSaving]      = useState(false)

  /* ── Form state ── */
  const [fTitle,    setFTitle]    = useState('')
  const [fDesc,     setFDesc]     = useState('')
  const [fDate,     setFDate]     = useState('')
  const [fTime,     setFTime]     = useState('')
  const [fPriority, setFPriority] = useState<CalTask['priority']>('normal')
  const [fCategory, setFCategory] = useState('task')
  const [fNotes,    setFNotes]    = useState('')
  const [fStatus,   setFStatus]   = useState<CalTask['status']>('pending')

  /* ── Calendar grid ── */
  const monthStart  = startOfMonth(currentDate)
  const monthEnd    = endOfMonth(currentDate)
  const calStart    = startOfWeek(monthStart, { locale: ptBR })
  const calEnd      = endOfWeek(monthEnd,    { locale: ptBR })
  const calDays     = eachDayOfInterval({ start: calStart, end: calEnd })

  /* ── Queries ── */
  const monthKey = format(currentDate, 'yyyy-MM')

  const { data: tasks } = useQuery<CalTask[]>({
    queryKey: ['calendar-tasks', companyId, monthKey],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await (supabase.from('calendar_tasks') as any)
        .select('*')
        .eq('company_id', companyId!)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd,   'yyyy-MM-dd'))
        .order('time')
      return (data ?? []) as CalTask[]
    },
  })

  const { data: orders } = useQuery<Order[]>({
    queryKey: ['calendar-orders', companyId, monthKey],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data } = await (supabase.from('orders') as any)
        .select('id, order_number, service_name, due_date, status, total, priority, customers(name)')
        .eq('company_id', companyId!)
        .gte('due_date', format(monthStart, 'yyyy-MM-dd') + 'T00:00:00')
        .lte('due_date', format(monthEnd,   'yyyy-MM-dd') + 'T23:59:59')
        .not('due_date', 'is', null)
      return (data ?? []) as Order[]
    },
  })

  /* ── Events per day ── */
  const eventsByDay = useMemo(() => {
    const map: Record<string, { tasks: CalTask[]; orders: Order[] }> = {}

    if (filter !== 'orders') {
      ;(tasks ?? []).forEach(t => {
        if (!map[t.date]) map[t.date] = { tasks: [], orders: [] }
        map[t.date].tasks.push(t)
      })
    }

    if (filter !== 'tasks') {
      ;(orders ?? []).forEach(o => {
        if (!o.due_date) return
        const d = o.due_date.split('T')[0]
        if (!map[d]) map[d] = { tasks: [], orders: [] }
        map[d].orders.push(o)
      })
    }

    return map
  }, [tasks, orders, filter])

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!fTitle.trim() || !fDate) throw new Error('Título e data são obrigatórios')
      setSaving(true)
      const payload = {
        company_id: companyId!,
        title: fTitle.trim(),
        description: fDesc || null,
        date: fDate,
        time: fTime || null,
        priority: fPriority,
        category: fCategory,
        status: fStatus,
        notes: fNotes || null,
      }
      if (editTask?.id) {
        const { error } = await (supabase.from('calendar_tasks') as any)
          .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editTask.id)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('calendar_tasks') as any)
          .insert([payload]).select()
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-tasks', companyId, monthKey] })
      toast('success', editTask ? 'Tarefa atualizada!' : 'Tarefa criada!')
      closeModal()
      setSaving(false)
    },
    onError: (err: Error) => {
      toast('error', err.message)
      setSaving(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('calendar_tasks') as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-tasks', companyId, monthKey] })
      toast('success', 'Tarefa removida.')
      setViewEvent(null)
    },
    onError: (err: Error) => toast('error', err.message),
  })

  /* ── Handlers ── */
  function selectDay(day: Date) {
    setSelectedDay(day)
    // Scroll suave para o painel do dia
    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function openNew(day?: Date) {
    setEditTask(null)
    setFTitle(''); setFDesc(''); setFTime(''); setFNotes('')
    setFPriority('normal'); setFCategory('task'); setFStatus('pending')
    setFDate(day ? format(day, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
    setShowModal(true)
  }

  function openEdit(task: CalTask) {
    setEditTask(task)
    setFTitle(task.title); setFDesc(task.description ?? ''); setFDate(task.date)
    setFTime(task.time ?? ''); setFPriority(task.priority); setFCategory(task.category)
    setFStatus(task.status); setFNotes(task.notes ?? '')
    setViewEvent(null); setShowModal(true)
  }

  function closeModal() {
    setShowModal(false); setEditTask(null)
  }

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <div className="page-enter min-h-screen">
      <Header title="Agenda" subtitle="Calendário de produção, entregas e tarefas" />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">

        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(d => subMonths(d, 1))}
              className="p-2 rounded-xl border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-all">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-base font-bold text-text-primary dark:text-stone-100 min-w-[160px] text-center capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button onClick={() => setCurrentDate(d => addMonths(d, 1))}
              className="p-2 rounded-xl border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-all">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setCurrentDate(new Date())}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-all ml-1">
              Hoje
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Filters */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-primary-50 dark:bg-white/[0.04]">
              {([['all','Todos'],['orders','Pedidos'],['tasks','Tarefas']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={clsx('px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                    filter === k
                      ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                      : 'text-text-muted dark:text-stone-500 hover:text-text-primary dark:hover:text-stone-300'
                  )}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={() => openNew()}
              className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2">
              <Plus size={15} /> Nova tarefa
            </button>
          </div>
        </div>

        {/* ── Calendar grid ── */}
        <div className="card p-0 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border dark:border-border-dark">
            {WEEKDAYS.map(d => (
              <div key={d} className="p-2 sm:p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted dark:text-stone-500">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const key       = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDay[key]
              const inMonth   = isSameMonth(day, currentDate)
              const today     = isToday(day)
              const hasEvents = dayEvents && (dayEvents.tasks.length + dayEvents.orders.length) > 0

              return (
                <div
                  key={key}
                  onClick={() => { if (inMonth) selectDay(day) }}
                  className={clsx(
                    'min-h-[56px] sm:min-h-[90px] border-b border-r border-border dark:border-border-dark p-1 sm:p-2 cursor-pointer transition-colors group',
                    'hover:bg-primary-50/40 dark:hover:bg-primary/5',
                    !inMonth && 'opacity-40',
                    i % 7 === 6 && 'border-r-0',
                    Math.floor(i / 7) === Math.floor((calDays.length - 1) / 7) && 'border-b-0'
                  )}
                >
                  {/* Day number */}
                  <div className={clsx(
                    'w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold mb-1 transition-colors',
                    today
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-primary dark:text-stone-200 group-hover:text-primary'
                  )}>
                    {format(day, 'd')}
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5" onClick={e => e.stopPropagation()}>
                    {/* Orders first */}
                    {(dayEvents?.orders ?? []).slice(0, 2).map(order => (
                      <button
                        key={order.id}
                        onClick={() => setViewEvent({ type: 'order', data: order })}
                        className={clsx(
                          'w-full text-left text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate border transition-all hover:opacity-80',
                          ORDER_STATUS_COLOR[order.status] ?? ORDER_STATUS_COLOR.pending
                        )}
                      >
                        📦 {order.service_name || 'Pedido'}
                      </button>
                    ))}

                    {/* Tasks */}
                    {(dayEvents?.tasks ?? []).slice(0, Math.max(0, 3 - (dayEvents?.orders?.length ?? 0))).map(task => {
                      const cfg = CATEGORY_CONFIG[task.category] ?? CATEGORY_CONFIG.task
                      return (
                        <button
                          key={task.id}
                          onClick={() => setViewEvent({ type: 'task', data: task })}
                          className={clsx(
                            'w-full text-left text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate transition-all hover:opacity-80',
                            task.status === 'done' ? 'opacity-50 line-through' : '',
                            cfg.color
                          )}
                        >
                          {cfg.emoji} {task.title}
                        </button>
                      )
                    })}

                    {/* +N more */}
                    {(() => {
                      const total = (dayEvents?.tasks?.length ?? 0) + (dayEvents?.orders?.length ?? 0)
                      const shown = Math.min(dayEvents?.orders?.length ?? 0, 2) + Math.min(dayEvents?.tasks?.length ?? 0, Math.max(0, 3 - (dayEvents?.orders?.length ?? 0)))
                      return total > shown ? (
                        <span className="text-[9px] text-text-muted dark:text-stone-500 pl-1">
                          +{total - shown} mais
                        </span>
                      ) : null
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted dark:text-stone-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"/>{' '}Pendente</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400"/>{' '}Produção</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400"/>{' '}Pronto/Entregue</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary"/>{' '}Hoje</span>
          <span className="ml-auto text-right">Clique num dia para ver o painel</span>
        </div>

        {/* ── DAY PANEL ── */}
        {selectedDay && (
          <div ref={panelRef} className="card p-0 overflow-hidden animate-fadeIn">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border dark:border-border-dark bg-primary-50/50 dark:bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary dark:text-stone-100 capitalize">
                    {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-[11px] text-text-muted dark:text-stone-500">
                    {(() => {
                      const key = format(selectedDay, 'yyyy-MM-dd')
                      const ev  = eventsByDay[key]
                      const t   = (ev?.tasks?.length ?? 0) + (ev?.orders?.length ?? 0)
                      return t === 0 ? 'Nenhum evento' : `${t} evento${t !== 1 ? 's' : ''}`
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => openNew(selectedDay)}
                className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2"
              >
                <Plus size={13} /> Nova tarefa
              </button>
            </div>

            {/* Panel body */}
            <div className="p-3 sm:p-4">
              {(() => {
                const key    = format(selectedDay, 'yyyy-MM-dd')
                const ev     = eventsByDay[key]
                const orders = ev?.orders ?? []
                const tasks  = ev?.tasks  ?? []

                if (orders.length === 0 && tasks.length === 0) {
                  return (
                    <div className="text-center py-8 text-text-muted dark:text-stone-500">
                      <CalendarDays size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum evento neste dia</p>
                      <button
                        onClick={() => openNew(selectedDay)}
                        className="mt-3 text-xs text-primary hover:underline"
                      >
                        + Adicionar tarefa
                      </button>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {/* Pedidos */}
                    {orders.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted dark:text-stone-500 mb-2 flex items-center gap-1.5">
                          <Package size={11} /> Pedidos ({orders.length})
                        </p>
                        <div className="space-y-2">
                          {orders.map(order => (
                            <button
                              key={order.id}
                              onClick={() => setViewEvent({ type: 'order', data: order })}
                              className={clsx(
                                'w-full text-left p-3 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-sm',
                                ORDER_STATUS_COLOR[order.status] ?? ORDER_STATUS_COLOR.pending
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold truncate">
                                    {order.service_name || '—'}
                                  </p>
                                  <p className="text-[11px] opacity-75 truncate">
                                    {order.customers?.name ?? 'Sem cliente'} · {order.order_number}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-bold">{fmt(order.total)}</p>
                                  {order.priority && (
                                    <span className={clsx('text-[10px] font-semibold', (PRIORITY_CONFIG as any)[order.priority]?.color ?? '')}>
                                      {(PRIORITY_CONFIG as any)[order.priority]?.label ?? order.priority}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tarefas */}
                    {tasks.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted dark:text-stone-500 mb-2 flex items-center gap-1.5">
                          <CheckCircle2 size={11} /> Tarefas ({tasks.length})
                        </p>
                        <div className="space-y-2">
                          {tasks.map(task => {
                            const cfg = CATEGORY_CONFIG[task.category] ?? CATEGORY_CONFIG.task
                            const pri = PRIORITY_CONFIG[task.priority]
                            return (
                              <button
                                key={task.id}
                                onClick={() => setViewEvent({ type: 'task', data: task })}
                                className={clsx(
                                  'w-full text-left p-3 rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/[0.02] transition-all hover:-translate-y-0.5 hover:shadow-sm hover:border-primary/30',
                                  task.status === 'done' && 'opacity-60'
                                )}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', pri.dot)} />
                                  <div className="min-w-0 flex-1">
                                    <p className={clsx('text-sm font-medium text-text-primary dark:text-stone-100 truncate', task.status === 'done' && 'line-through')}>
                                      {cfg.emoji} {task.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {task.time && (
                                        <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                                          <Clock size={9} />{task.time.slice(0, 5)}
                                        </span>
                                      )}
                                      <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cfg.color)}>
                                        {cfg.label}
                                      </span>
                                    </div>
                                  </div>
                                  {task.status === 'done' && (
                                    <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          MODAL VIEW EVENT (task ou order)
      ══════════════════════════════════════════ */}
      {viewEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewEvent(null)} />
          <div className="relative bg-white dark:bg-[#1C1714] border border-border dark:border-stone-800 w-full sm:max-w-md rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.4)] animate-scaleIn overflow-hidden">

            {viewEvent.type === 'order' ? (
              /* ── Order view ── */
              (() => {
                const o = viewEvent.data as Order
                const colorCls = ORDER_STATUS_COLOR[o.status] ?? ORDER_STATUS_COLOR.pending
                // Header com gradiente dark-safe
                const headerBg = o.status === 'production'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-stone-700'
                  : o.status === 'ready'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-stone-700'
                  : o.status === 'delivered'
                  ? 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-stone-700'
                return (
                  <>
                    <div className={clsx('p-4 border-b', headerBg)}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Package size={14} className="flex-shrink-0" />
                            <span className="text-xs font-mono">{o.order_number || '—'}</span>
                            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', colorCls)}>
                              {o.status === 'pending' ? 'Pendente' : o.status === 'production' ? 'Produção' : o.status === 'ready' ? 'Pronto' : 'Entregue'}
                            </span>
                          </div>
                          <p className="text-base font-bold text-text-primary dark:text-stone-100">{o.service_name || '—'}</p>
                          <p className="text-sm text-text-muted mt-0.5">{o.customers?.name ?? 'Sem cliente'}</p>
                        </div>
                        <button onClick={() => setViewEvent(null)} className="p-1.5 rounded-xl hover:bg-black/10 text-text-muted flex-shrink-0">
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 space-y-3 bg-white dark:bg-[#1C1714]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted dark:text-stone-400">Entrega</span>
                        <span className="text-sm font-semibold text-text-primary dark:text-stone-100">
                          {o.due_date ? format(parseISO(o.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">Valor</span>
                        <span className="text-sm font-bold text-primary">{fmt(o.total)}</span>
                      </div>
                      {o.priority && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-muted">Prioridade</span>
                          <span className={clsx('text-xs font-semibold', (PRIORITY_CONFIG as any)[o.priority]?.color)}>
                            {(PRIORITY_CONFIG as any)[o.priority]?.label ?? o.priority}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()
            ) : (
              /* ── Task view ── */
              (() => {
                const t = viewEvent.data as CalTask
                const cfg = CATEGORY_CONFIG[t.category] ?? CATEGORY_CONFIG.task
                const pri = PRIORITY_CONFIG[t.priority]
                return (
                  <>
                    <div className="p-4 border-b border-border dark:border-stone-800 bg-white dark:bg-[#1C1714]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.color)}>
                              {cfg.emoji} {cfg.label}
                            </span>
                            {t.status === 'done' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✓ Concluída</span>}
                          </div>
                          <p className={clsx('text-base font-bold text-text-primary dark:text-stone-100', t.status === 'done' && 'line-through opacity-60')}>{t.title}</p>
                          {t.description && <p className="text-sm text-text-muted mt-0.5 truncate">{t.description}</p>}
                        </div>
                        <button onClick={() => setViewEvent(null)} className="p-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-stone-700 text-text-muted dark:text-stone-400 flex-shrink-0">
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 space-y-2.5 bg-white dark:bg-[#1C1714]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted dark:text-stone-400 flex items-center gap-1"><CalendarDays size={11}/>Data</span>
                        <span className="text-sm font-medium text-text-primary dark:text-stone-100">
                          {format(parseISO(t.date), "dd 'de' MMMM", { locale: ptBR })}
                          {t.time && <span className="ml-2 text-text-muted">• {t.time.slice(0, 5)}</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted flex items-center gap-1"><Flag size={11}/>Prioridade</span>
                        <span className={clsx('text-xs font-semibold flex items-center gap-1', pri.color)}>
                          <span className={clsx('w-2 h-2 rounded-full', pri.dot)}/> {pri.label}
                        </span>
                      </div>
                      {t.notes && (
                        <p className="text-xs text-text-muted dark:text-stone-400 border border-border dark:border-stone-700 rounded-xl p-3 bg-primary-50/30 dark:bg-primary/10">
                          {t.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 p-4 border-t border-border dark:border-stone-800 bg-white dark:bg-[#1C1714]">
                      <button onClick={() => openEdit(t)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2">
                        <Edit3 size={12} /> Editar
                      </button>
                      <button
                        onClick={() => {
                          const next: CalTask['status'] = t.status === 'done' ? 'pending' : 'done'
                          ;(supabase.from('calendar_tasks') as any).update({ status: next }).eq('id', t.id).then(() => {
                            qc.invalidateQueries({ queryKey: ['calendar-tasks', companyId, monthKey] })
                            toast('success', next === 'done' ? 'Concluída!' : 'Reaberta!')
                            setViewEvent(null)
                          })
                        }}
                        className={clsx('flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-medium transition-all',
                          t.status === 'done'
                            ? 'border border-border dark:border-border-dark text-text-muted hover:text-text-primary'
                            : 'bg-green-500 text-white hover:bg-green-600'
                        )}
                      >
                        <CheckCircle2 size={12} /> {t.status === 'done' ? 'Reabrir' : 'Concluir'}
                      </button>
                      <button onClick={() => deleteMutation.mutate(t.id)} disabled={deleteMutation.isPending}
                        className="p-2 rounded-xl text-text-muted hover:text-error hover:bg-error-light transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )
              })()
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL CRIAR / EDITAR TAREFA
      ══════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-modal animate-scaleIn max-h-[92dvh] flex flex-col overflow-hidden">

            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <h2 className="text-base font-bold text-text-primary dark:text-stone-100">
                {editTask ? 'Editar tarefa' : 'Nova tarefa'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Título *</label>
                <input className="input" placeholder="O que precisa fazer?" value={fTitle} onChange={e => setFTitle(e.target.value)} autoFocus />
              </div>

              {/* Categoria + Prioridade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Tipo</label>
                  <select className="input" value={fCategory} onChange={e => setFCategory(e.target.value)}>
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Prioridade</label>
                  <select className="input" value={fPriority} onChange={e => setFPriority(e.target.value as CalTask['priority'])}>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data + Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Data *</label>
                  <input type="date" className="input" value={fDate} onChange={e => setFDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Horário</label>
                  <input type="time" className="input" value={fTime} onChange={e => setFTime(e.target.value)} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Status</label>
                <div className="flex gap-2">
                  {([
                    ['pending',    'Pendente',      Circle       ],
                    ['in_progress','Em andamento',  AlertCircle  ],
                    ['done',       'Concluída',     CheckCircle2 ],
                  ] as const).map(([k, l, Icon]) => (
                    <button key={k} type="button" onClick={() => setFStatus(k)}
                      className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all',
                        fStatus === k
                          ? k === 'done' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            : k === 'in_progress' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'border-primary bg-primary-50 dark:bg-primary/10 text-primary'
                          : 'border-border dark:border-border-dark text-text-muted'
                      )}>
                      <Icon size={12} /> {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Descrição</label>
                <textarea rows={2} className="input resize-none text-sm" placeholder="Detalhes da tarefa..."
                  value={fDesc} onChange={e => setFDesc(e.target.value)} />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Observações</label>
                <textarea rows={2} className="input resize-none text-sm" placeholder="Anotações extras..."
                  value={fNotes} onChange={e => setFNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
              <button onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => saveMutation.mutate()} disabled={saving || !fTitle.trim() || !fDate}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Salvando...' : editTask ? 'Salvar' : 'Criar tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
