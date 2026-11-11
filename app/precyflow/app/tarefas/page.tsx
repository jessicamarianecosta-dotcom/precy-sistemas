'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckSquare, Check, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowModal } from '@/components/precyflow/Modal'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'
import { format, isPast } from 'date-fns'

interface Task {
  id: string
  title: string
  date: string
  priority: string | null
  status: string
}

const PRIORITY_LABELS: Record<string, string> = { low: 'Baixa', normal: 'Média', high: 'Alta', urgent: 'Urgente' }
const PRIORITY_CLASS: Record<string, string> = {
  low: 'bg-success-light text-success-dark', normal: 'bg-info-light text-info-dark',
  high: 'bg-warning-light text-warning-dark', urgent: 'bg-error-light text-error-dark',
}

type Filter = 'pendentes' | 'concluidas' | 'todas'

function useTasks(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-tarefas', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('calendar_tasks')
        .select('id, title, date, priority, status')
        .eq('company_id', companyId as string)
        .order('date', { ascending: true }) as any
      if (error) throw error
      return (data ?? []) as Task[]
    },
  })
}

const emptyForm = { title: '', date: format(new Date(), 'yyyy-MM-dd'), priority: 'normal' }

export default function PrecyflowTarefasPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: tasks, isLoading } = useTasks(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [filter, setFilter] = useState<Filter>('pendentes')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = (tasks ?? []).filter(t => {
    if (filter === 'pendentes') return t.status !== 'done'
    if (filter === 'concluidas') return t.status === 'done'
    return true
  })

  async function toggleStatus(t: Task) {
    await (supabase.from('calendar_tasks') as any).update({ status: t.status === 'done' ? 'pending' : 'done' }).eq('id', t.id)
    queryClient.invalidateQueries({ queryKey: ['precyflow-tarefas', companyId] })
  }

  async function handleSave() {
    if (!companyId) return
    if (!form.title.trim()) { setError('Informe o título da tarefa.'); return }
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await (supabase.from('calendar_tasks') as any).insert({
        company_id: companyId, title: form.title.trim(), date: form.date,
        priority: form.priority, category: 'task', status: 'pending',
      })
      if (err) throw err
      await queryClient.invalidateQueries({ queryKey: ['precyflow-tarefas', companyId] })
      setShowForm(false)
      setForm(emptyForm)
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PrecyflowHeader title="Tarefas" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="pf-card inline-flex p-1 gap-1">
            {(['pendentes', 'concluidas', 'todas'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === f ? 'pf-btn-primary' : ''}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)} className="pf-btn-primary flex items-center gap-2 px-4 py-2.5">
            <Plus size={16} /> Nova tarefa
          </button>
        </div>

        {isLoading ? (
          <div className="pf-card h-48 animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="pf-card">
            <PrecyflowEmptyState icon={CheckSquare} title="Nenhuma tarefa por aqui" subtitle="Cadastre tarefas simples do dia a dia do seu negócio." />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => {
              const overdue = t.status !== 'done' && isPast(new Date(t.date + 'T23:59:59'))
              return (
                <div key={t.id} className="pf-card p-3 flex items-center gap-3">
                  <button
                    onClick={() => toggleStatus(t)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${t.status === 'done' ? 'pf-btn-primary' : ''}`}
                    style={t.status !== 'done' ? { borderColor: 'var(--pf-border)' } : undefined}
                  >
                    {t.status === 'done' && <Check size={12} color="white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</p>
                    <p className={`text-xs mt-0.5 ${overdue ? 'text-error font-medium' : ''}`} style={!overdue ? { color: 'var(--pf-text-secondary)' } : undefined}>
                      Vencimento: {format(new Date(t.date + 'T00:00:00'), 'dd/MM/yyyy')}{overdue ? ' · Atrasada' : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_CLASS[t.priority ?? 'normal']}`}>
                    {PRIORITY_LABELS[t.priority ?? 'normal']}
                  </span>
                  {t.status === 'done' && (
                    <button onClick={() => toggleStatus(t)} className="p-1.5 rounded-lg hover:pf-bg-primary-soft flex-shrink-0" title="Reabrir">
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <PrecyflowModal title="Nova tarefa" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Título</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Comprar fita de cetim" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Vencimento</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Prioridade</label>
                <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Salvando...' : 'Salvar tarefa'}
            </button>
          </div>
        </PrecyflowModal>
      )}
    </div>
  )
}
