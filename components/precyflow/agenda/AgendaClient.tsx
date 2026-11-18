'use client'

import { useMemo, useState } from 'react'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, List as ListIcon, Grid3x3, Plus, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import type { PrecyFlowAgendaEvent, PrecyFlowCustomer } from '@/lib/precyflow/types'

export function AgendaClient({
  storeId,
  initialEvents,
  customers,
}: {
  storeId: string
  initialEvents: PrecyFlowAgendaEvent[]
  customers: PrecyFlowCustomer[]
}) {
  const [events, setEvents] = useState(initialEvents)
  const [view, setView] = useState<'calendario' | 'lista'>('calendario')
  const [month, setMonth] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [reminder, setReminder] = useState(false)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PrecyFlowAgendaEvent[]>()
    for (const ev of events) {
      const key = ev.event_date
      map.set(key, [...(map.get(key) ?? []), ev])
    }
    return map
  }, [events])

  const upcoming = useMemo(
    () => [...events].filter(e => !e.completed).sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events]
  )

  function openNew(date?: Date) {
    setTitle('')
    setDescription('')
    setEventDate(date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
    setEventTime('')
    setCustomerId('')
    setReminder(false)
    setError(null)
    setShowForm(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Informe um título.'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: created, error: insertError } = await supabase
        .from('precyflow_agenda_events')
        .insert({
          store_id: storeId,
          title,
          description: description || null,
          event_date: eventDate,
          event_time: eventTime || null,
          customer_id: customerId || null,
          reminder,
        })
        .select()
        .single()
      if (insertError) throw insertError
      setEvents(prev => [...prev, created as PrecyFlowAgendaEvent])
      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao criar compromisso.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleComplete(ev: PrecyFlowAgendaEvent) {
    const supabase = createClient()
    const { data: updated, error: updateError } = await supabase
      .from('precyflow_agenda_events').update({ completed: !ev.completed }).eq('id', ev.id).select().single()
    if (!updateError) setEvents(prev => prev.map(e => (e.id === ev.id ? (updated as PrecyFlowAgendaEvent) : e)))
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Agenda</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Compromissos, entregas e produção</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--pf-border)' }}>
            <button onClick={() => setView('calendario')} className="px-3 py-2" style={{ backgroundColor: view === 'calendario' ? 'var(--pf-primary)' : 'transparent', color: view === 'calendario' ? '#fff' : 'var(--pf-text-secondary)' }} aria-label="Calendário">
              <Grid3x3 size={16} />
            </button>
            <button onClick={() => setView('lista')} className="px-3 py-2" style={{ backgroundColor: view === 'lista' ? 'var(--pf-primary)' : 'transparent', color: view === 'lista' ? '#fff' : 'var(--pf-text-secondary)' }} aria-label="Lista">
              <ListIcon size={16} />
            </button>
          </div>
          <button onClick={() => openNew()} className="pf-btn-primary"><Plus size={16} /> Novo compromisso</button>
        </div>
      </div>

      {view === 'calendario' ? (
        <div className="pf-card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMonth(m => addMonths(m, -1))} aria-label="Mês anterior" style={{ color: 'var(--pf-text-secondary)' }}><ChevronLeft size={18} /></button>
            <h2 className="font-semibold capitalize" style={{ color: 'var(--pf-text)' }}>{format(month, 'MMMM yyyy', { locale: ptBR })}</h2>
            <button onClick={() => setMonth(m => addMonths(m, 1))} aria-label="Próximo mês" style={{ color: 'var(--pf-text-secondary)' }}><ChevronRight size={18} /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium mb-2" style={{ color: 'var(--pf-text-secondary)' }}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDay.get(key) ?? []
              const inMonth = isSameMonth(day, month)
              const today = isSameDay(day, new Date())
              return (
                <button
                  key={key}
                  onClick={() => openNew(day)}
                  className="rounded-lg p-1.5 text-left min-h-[64px] text-xs"
                  style={{
                    backgroundColor: today ? 'color-mix(in srgb, var(--pf-primary) 10%, transparent)' : 'var(--pf-bg)',
                    opacity: inMonth ? 1 : 0.4,
                    border: today ? '1px solid var(--pf-primary)' : '1px solid transparent',
                  }}
                >
                  <div className="font-medium" style={{ color: 'var(--pf-text)' }}>{format(day, 'd')}</div>
                  {dayEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} className="truncate mt-0.5 px-1 rounded" style={{ backgroundColor: 'var(--pf-primary)', color: '#fff', opacity: ev.completed ? 0.5 : 1 }}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div style={{ color: 'var(--pf-text-secondary)' }}>+{dayEvents.length - 2}</div>}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="pf-card !p-0 overflow-hidden">
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nenhum compromisso" description="Adicione compromissos, entregas ou etapas de produção." action={<button onClick={() => openNew()} className="pf-btn-primary"><Plus size={16} /> Novo compromisso</button>} />
          ) : (
            <div>
              {upcoming.map(ev => (
                <div key={ev.id} className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--pf-border)' }}>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--pf-text)' }}>{ev.title}</div>
                    <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>
                      {format(new Date(ev.event_date + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}{ev.event_time ? ` às ${ev.event_time.slice(0, 5)}` : ''}
                    </div>
                  </div>
                  <button onClick={() => toggleComplete(ev)} className="pf-btn-ghost !px-3 !py-1.5 text-xs"><Check size={14} /> Concluir</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <Modal title="Novo compromisso" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Título</label>
              <input className="pf-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Data</label>
                <input type="date" className="pf-input" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Horário</label>
                <input type="time" className="pf-input" value={eventTime} onChange={e => setEventTime(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Cliente (opcional)</label>
              <select className="pf-input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">—</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Descrição</label>
              <textarea className="pf-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--pf-text)' }}>
              <input type="checkbox" checked={reminder} onChange={e => setReminder(e.target.checked)} />
              Lembrete
            </label>

            {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>{error}</div>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="pf-btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={saving} className="pf-btn-primary flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
