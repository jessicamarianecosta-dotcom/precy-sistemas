'use client'

import { useMemo, useState } from 'react'
import { CheckSquare, Plus, Loader2, RotateCcw, Check } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase-client'
import { formatDateBR } from '@/lib/precyflow/format'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import { TASK_PRIORITY_LABELS, type PrecyFlowTask, type PrecyFlowTaskPriority } from '@/lib/precyflow/types'

export function TarefasClient({ storeId, initialTasks }: { storeId: string; initialTasks: PrecyFlowTask[] }) {
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<'abertas' | 'concluidas' | 'todas'>('abertas')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<PrecyFlowTaskPriority>('media')

  const filtered = useMemo(() => {
    if (filter === 'abertas') return tasks.filter(t => t.status === 'aberta')
    if (filter === 'concluidas') return tasks.filter(t => t.status === 'concluida')
    return tasks
  }, [tasks, filter])

  function openNew() {
    setTitle('')
    setDueDate('')
    setPriority('media')
    setError(null)
    setShowForm(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Informe o título.'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: created, error: insertError } = await supabase
        .from('precyflow_tasks')
        .insert({ store_id: storeId, title, due_date: dueDate || null, priority })
        .select()
        .single()
      if (insertError) throw insertError
      setTasks(prev => [created as PrecyFlowTask, ...prev])
      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao criar tarefa.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(task: PrecyFlowTask) {
    const supabase = createClient()
    const nextStatus = task.status === 'aberta' ? 'concluida' : 'aberta'
    const { data: updated, error: updateError } = await supabase
      .from('precyflow_tasks').update({ status: nextStatus }).eq('id', task.id).select().single()
    if (!updateError) setTasks(prev => prev.map(t => (t.id === task.id ? (updated as PrecyFlowTask) : t)))
  }

  const priorityColor: Record<PrecyFlowTaskPriority, string> = { baixa: 'var(--pf-success)', media: 'var(--pf-warning)', alta: 'var(--pf-error)' }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Tarefas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>O que precisa ser feito</p>
        </div>
        <button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Nova tarefa</button>
      </div>

      <div className="flex gap-2 mb-4">
        {(['abertas', 'concluidas', 'todas'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className="pf-badge" style={{ backgroundColor: filter === f ? 'var(--pf-primary)' : 'var(--pf-bg)', color: filter === f ? '#fff' : 'var(--pf-text-secondary)', border: '1px solid var(--pf-border)' }}>
            {f === 'abertas' ? 'Abertas' : f === 'concluidas' ? 'Concluídas' : 'Todas'}
          </button>
        ))}
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={CheckSquare} title="Nenhuma tarefa" description="Crie tarefas para organizar o que precisa ser feito." action={<button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Nova tarefa</button>} />
        ) : (
          <div>
            {filtered.map(task => (
              <div key={task.id} className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--pf-border)' }}>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityColor[task.priority] }} />
                  <div>
                    <div className="font-medium" style={{ color: 'var(--pf-text)', textDecoration: task.status === 'concluida' ? 'line-through' : 'none' }}>{task.title}</div>
                    <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>
                      {TASK_PRIORITY_LABELS[task.priority]}{task.due_date ? ` · vence em ${formatDateBR(task.due_date)}` : ''}
                    </div>
                  </div>
                </div>
                <button onClick={() => toggleStatus(task)} className="pf-btn-ghost !px-3 !py-1.5 text-xs">
                  {task.status === 'aberta' ? <><Check size={14} /> Concluir</> : <><RotateCcw size={14} /> Reabrir</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <Modal title="Nova tarefa" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Título</label>
              <input className="pf-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Vencimento</label>
                <input type="date" className="pf-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Prioridade</label>
                <select className="pf-input" value={priority} onChange={e => setPriority(e.target.value as PrecyFlowTaskPriority)}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </div>

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
