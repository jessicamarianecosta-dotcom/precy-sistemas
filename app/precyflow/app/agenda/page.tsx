'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, CalendarDays, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowModal } from '@/components/precyflow/Modal'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Task {
  id: string
  title: string
  description: string | null
  date: string
  time: string | null
  category: string
  status: string
}

const CATEGORY_LABELS: Record<string, string> = {
  task: 'Tarefa', production: 'Produção', delivery: 'Entrega',
  meeting: 'Compromisso', financial: 'Financeiro', personal: 'Pessoal', reminder: 'Lembrete',
}

function useAgenda(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-agenda', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('calendar_tasks')
        .select('id, title, description, date, time, category, status')
        .eq('company_id', companyId as string)
        .order('date', { ascending: true }) as any
      if (error) throw error
      return (data ?? []) as Task[]
    },
  })
}

const emptyForm = { title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'), time: '', category: 'meeting' }

export default function PrecyflowAgendaPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data: tasks, isLoading } = useAgenda(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upcoming = (tasks ?? []).filter(t => t.status !== 'done')
  const done = (tasks ?? []).filter(t => t.status === 'done')

  async function toggleDone(t: Task) {
    await (supabase.from('calendar_tasks') as any).update({ status: t.status === 'done' ? 'pending' : 'done' }).eq('id', t.id)
    queryClient.invalidateQueries({ queryKey: ['precyflow-agenda', companyId] })
  }

  async function handleSave() {
    if (!companyId) return
    if (!form.title.trim()) { setError('Informe o título do compromisso.'); return }
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await (supabase.from('calendar_tasks') as any).insert({
        company_id: companyId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        date: form.date,
        time: form.time || null,
        category: form.category,
        status: 'pending',
      })
      if (err) throw err
      await queryClient.invalidateQueries({ queryKey: ['precyflow-agenda', companyId] })
      setShowForm(false)
      setForm(emptyForm)
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function renderItem(t: Task) {
    return (
      <div key={t.id} className="pf-card p-3 flex items-start gap-3">
        <button
          onClick={() => toggleDone(t)}
          className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${t.status === 'done' ? 'pf-btn-primary' : ''}`}
          style={t.status !== 'done' ? { borderColor: 'var(--pf-border)' } : undefined}
        >
          {t.status === 'done' && <Check size={12} color="white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--pf-text-secondary)' }}>
            {format(new Date(t.date + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })}
            {t.time && ` às ${t.time.slice(0, 5)}`} · {CATEGORY_LABELS[t.category] ?? t.category}
          </p>
          {t.description && <p className="text-xs mt-1" style={{ color: 'var(--pf-text-muted)' }}>{t.description}</p>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PrecyflowHeader title="Agenda" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="pf-btn-primary flex items-center gap-2 px-4 py-2.5">
            <Plus size={16} /> Novo compromisso
          </button>
        </div>

        {isLoading ? (
          <div className="pf-card h-48 animate-pulse" />
        ) : !tasks?.length ? (
          <div className="pf-card">
            <PrecyflowEmptyState icon={CalendarDays} title="Nenhum compromisso ainda" subtitle="Cadastre entregas, etapas de produção e compromissos." />
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.length > 0 && <div className="space-y-2">{upcoming.map(renderItem)}</div>}
            {done.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold uppercase" style={{ color: 'var(--pf-text-muted)' }}>Concluídos</p>
                {done.map(renderItem)}
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <PrecyflowModal title="Novo compromisso" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Título</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Entregar pedido #2003" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Data</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Horário (opcional)</label>
                <input type="time" className="input" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Categoria</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Observações (opcional)</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </PrecyflowModal>
      )}
    </div>
  )
}
