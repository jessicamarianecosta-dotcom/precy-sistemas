'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DollarSign, Plus, Loader2, TrendingUp, TrendingDown, Clock, Pencil } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { formatBRL, formatDateBR } from '@/lib/precyflow/format'
import { EmptyState } from '@/components/precyflow/EmptyState'
import { Modal } from '@/components/precyflow/Modal'
import type { PrecyFlowTransaction, PrecyFlowTransactionStatus, PrecyFlowTransactionType } from '@/lib/precyflow/types'

const schema = z.object({
  type: z.enum(['entrada', 'saida']),
  description: z.string().min(1, 'Informe a descrição'),
  category: z.string().min(1, 'Informe a categoria'),
  amount: z.coerce.number().min(0.01, 'Informe um valor'),
  due_date: z.string().optional(),
  payment_date: z.string().optional(),
  payment_method: z.string().optional(),
  status: z.enum(['pendente', 'pago', 'atrasado']),
})
type FormData = z.infer<typeof schema>

const STATUS_LABELS: Record<PrecyFlowTransactionStatus, string> = { pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado' }

export function FinanceiroClient({ storeId, initialTransactions }: { storeId: string; initialTransactions: PrecyFlowTransaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [filter, setFilter] = useState<'todos' | PrecyFlowTransactionType>('todos')
  const [editing, setEditing] = useState<PrecyFlowTransaction | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const summary = useMemo(() => {
    const entradas = transactions.filter(t => t.type === 'entrada' && t.status === 'pago').reduce((s, t) => s + Number(t.amount), 0)
    const saidas = transactions.filter(t => t.type === 'saida' && t.status === 'pago').reduce((s, t) => s + Number(t.amount), 0)
    const aReceber = transactions.filter(t => t.type === 'entrada' && t.status !== 'pago').reduce((s, t) => s + Number(t.amount), 0)
    const aPagar = transactions.filter(t => t.type === 'saida' && t.status !== 'pago').reduce((s, t) => s + Number(t.amount), 0)
    return { entradas, saidas, aReceber, aPagar }
  }, [transactions])

  const filtered = useMemo(() => (filter === 'todos' ? transactions : transactions.filter(t => t.type === filter)), [transactions, filter])

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })
  const watchedType = watch('type')

  function openNew() {
    setEditing(null)
    reset({ type: 'entrada', description: '', category: 'geral', amount: 0, due_date: '', payment_date: '', payment_method: '', status: 'pendente' })
    setShowForm(true)
  }

  function openEdit(t: PrecyFlowTransaction) {
    setEditing(t)
    reset({
      type: t.type, description: t.description ?? '', category: t.category, amount: t.amount,
      due_date: t.due_date?.slice(0, 10) ?? '', payment_date: t.payment_date?.slice(0, 10) ?? '',
      payment_method: t.payment_method ?? '', status: t.status,
    })
    setShowForm(true)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload = {
        store_id: storeId,
        type: data.type,
        description: data.description,
        category: data.category,
        amount: data.amount,
        due_date: data.due_date || null,
        payment_date: data.payment_date || null,
        payment_method: data.payment_method || null,
        status: data.status,
      }

      if (editing) {
        const { data: updated, error: updateError } = await supabase
          .from('precyflow_financial_transactions').update(payload).eq('id', editing.id).select().single()
        if (updateError) throw updateError
        setTransactions(prev => prev.map(t => (t.id === editing.id ? (updated as PrecyFlowTransaction) : t)))
      } else {
        const { data: created, error: insertError } = await supabase
          .from('precyflow_financial_transactions').insert(payload).select().single()
        if (insertError) throw insertError
        setTransactions(prev => [created as PrecyFlowTransaction, ...prev])
      }

      setShowForm(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao salvar lançamento.')
    } finally {
      setSaving(false)
    }
  }

  const cards = [
    { label: 'Entradas (pago)', value: formatBRL(summary.entradas), icon: TrendingUp },
    { label: 'Saídas (pago)', value: formatBRL(summary.saidas), icon: TrendingDown },
    { label: 'A receber', value: formatBRL(summary.aReceber), icon: Clock },
    { label: 'A pagar', value: formatBRL(summary.aPagar), icon: Clock },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pf-text)' }}>Financeiro</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pf-text-secondary)' }}>Entradas, saídas e o que falta receber</p>
        </div>
        <button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo lançamento</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="pf-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--pf-text-secondary)' }}>{label}</span>
              <Icon size={16} style={{ color: 'var(--pf-primary)' }} />
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--pf-text)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['todos', 'entrada', 'saida'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="pf-badge"
            style={{ backgroundColor: filter === f ? 'var(--pf-primary)' : 'var(--pf-bg)', color: filter === f ? '#fff' : 'var(--pf-text-secondary)', border: '1px solid var(--pf-border)' }}
          >
            {f === 'todos' ? 'Todos' : f === 'entrada' ? 'Entradas' : 'Saídas'}
          </button>
        ))}
      </div>

      <div className="pf-card !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={DollarSign} title="Nenhum lançamento ainda" description="Registre entradas e saídas para acompanhar seu caixa." action={<button onClick={openNew} className="pf-btn-primary"><Plus size={16} /> Novo lançamento</button>} />
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pf-border)' }}>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Descrição</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Categoria</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Vencimento</th>
                  <th className="text-left font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Status</th>
                  <th className="text-right font-medium px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>Valor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--pf-border)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--pf-text)' }}>{t.description}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{t.category}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{formatDateBR(t.due_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`pf-badge ${t.status === 'pago' ? 'pf-badge-success' : t.status === 'atrasado' ? 'pf-badge-error' : 'pf-badge-warning'}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: t.type === 'entrada' ? 'var(--pf-success)' : 'var(--pf-error)' }}>
                      {t.type === 'entrada' ? '+' : '-'}{formatBRL(t.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(t)} aria-label="Editar" style={{ color: 'var(--pf-text-secondary)' }}><Pencil size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title={editing ? 'Editar lançamento' : 'Novo lançamento'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Tipo</label>
                <select className="pf-input" {...register('type')}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Status</label>
                <select className="pf-input" {...register('status')}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="atrasado">Atrasado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Descrição</label>
              <input className="pf-input" {...register('description')} />
              {errors.description && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Categoria</label>
                <input className="pf-input" {...register('category')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Valor (R$)</label>
                <input type="number" step="0.01" className="pf-input" {...register('amount')} />
                {errors.amount && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.amount.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Vencimento</label>
                <input type="date" className="pf-input" {...register('due_date')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>
                  Data de {watchedType === 'saida' ? 'pagamento' : 'recebimento'}
                </label>
                <input type="date" className="pf-input" {...register('payment_date')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Forma de pagamento</label>
              <input className="pf-input" placeholder="Pix, dinheiro, cartão..." {...register('payment_method')} />
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
