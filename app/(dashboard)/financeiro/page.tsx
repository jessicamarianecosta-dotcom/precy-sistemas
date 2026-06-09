'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { DollarSign, Plus, TrendingUp, TrendingDown, X, Loader2, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'

/* ─── Schema ─── */
const schema = z.object({
  type:        z.enum(['income', 'expense']),
  category:    z.string().min(1, 'Categoria obrigatória'),
  amount:      z.coerce.number().min(0.01, 'Valor deve ser maior que 0'),
  description: z.string().optional(),
  date:        z.string(),
})
type FormData = z.infer<typeof schema>

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function FinanceiroPage() {
  const supabase      = createClient()
  const qc            = useQueryClient()
  const { toast }     = useToast()
  const { companyId } = useCompanyId()

  const [showModal,    setShowModal]    = useState(false)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [filterType,   setFilterType]   = useState('all')

  /* ── Query ── */
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data, error } = await (supabase.from('transactions') as any)
        .select('*').eq('company_id', companyId!).order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  /* ── Form ── */
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'income', date: format(new Date(), 'yyyy-MM-dd'), category: 'vendas' },
  })

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: async (d: FormData) => {
      const { error } = await (supabase.from('transactions') as any)
        .insert([{ ...d, company_id: companyId! }]).select()
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', companyId] })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      toast('success', 'Transação registrada!')
      setShowModal(false)
      reset()
    },
    onError: (err: Error) => {
      console.error('[financeiro] save error:', err)
      toast('error', `Erro ao registrar: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('transactions') as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', companyId] })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      toast('success', 'Transação removida.')
      setDeleteId(null)
    },
    onError: (err: Error) => {
      console.error('[financeiro] delete error:', err)
      toast('error', `Erro ao excluir: ${err.message}`)
    },
  })

  /* ── Computed ── */
  const totalIncome  = (transactions ?? []).filter((t: Record<string, unknown>) => t.type === 'income').reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount), 0)
  const totalExpense = (transactions ?? []).filter((t: Record<string, unknown>) => t.type === 'expense').reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount), 0)
  const balance      = totalIncome - totalExpense
  const filtered     = (transactions ?? []).filter((t: Record<string, unknown>) => filterType === 'all' || t.type === filterType)

  return (
    <div className="page-enter">
      <Header title="Financeiro" subtitle="Controle de receitas e despesas" />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Receitas',  value: totalIncome,   icon: TrendingUp,   color: 'text-success', bg: 'bg-success-light dark:bg-success/10' },
            { label: 'Despesas',  value: totalExpense,  icon: TrendingDown, color: 'text-error',   bg: 'bg-error-light dark:bg-error/10'     },
            { label: 'Saldo',     value: balance,       icon: DollarSign,   color: balance >= 0 ? 'text-success' : 'text-error', bg: balance >= 0 ? 'bg-success-light dark:bg-success/10' : 'bg-error-light dark:bg-error/10' },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="card flex items-center gap-4 p-4">
                <div className={clsx('p-2.5 rounded-xl flex-shrink-0', card.bg)}>
                  <Icon size={20} className={card.color} />
                </div>
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{card.label}</p>
                  <p className={clsx('text-xl font-bold', card.color)}>{fmt(card.value)}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex gap-2">
            {[{v:'all',l:'Todos'},{v:'income',l:'Receitas'},{v:'expense',l:'Despesas'}].map(btn => (
              <button key={btn.v} onClick={() => setFilterType(btn.v)}
                className={clsx('px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                  filterType === btn.v ? 'bg-primary text-white' : 'text-text-secondary hover:bg-primary-50 dark:hover:bg-white/5')}>
                {btn.l}
              </button>
            ))}
          </div>
          <button onClick={() => { reset(); setShowModal(true) }} className="btn-primary flex items-center gap-2 w-full sm:w-auto">
            <Plus size={16} /> Nova Transação
          </button>
        </div>

        {/* Tabela */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={6} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={DollarSign} title="Sem transações"
              description="Registre receitas e despesas para controlar suas finanças."
              action={{ label: '+ Nova Transação', onClick: () => setShowModal(true) }} />
          ) : (
            <div className="overflow-x-auto -mx-0 w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark">
                    {['Tipo', 'Descrição', 'Categoria', 'Data', 'Valor', ''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t: Record<string, unknown>) => (
                    <tr key={t.id as string} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center',
                          t.type === 'income' ? 'bg-success-light' : 'bg-error-light')}>
                          {t.type === 'income'
                            ? <TrendingUp size={14} className="text-success" />
                            : <TrendingDown size={14} className="text-error" />}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                          {(t.description as string) || (t.type === 'income' ? 'Receita' : 'Despesa')}
                        </p>
                      </td>
                      <td className="p-4"><span className="badge badge-primary">{t.category as string}</span></td>
                      <td className="p-4 text-sm text-text-secondary dark:text-stone-300">
                        {format(new Date(t.date as string), 'dd/MM/yyyy')}
                      </td>
                      <td className="p-4">
                        <span className={clsx('text-sm font-bold', t.type === 'income' ? 'text-success' : 'text-error')}>
                          {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                        </span>
                      </td>
                      <td className="p-4">
                        <button onClick={() => setDeleteId(t.id as string)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Transação */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-md animate-scaleIn">
            <div className="p-6 border-b border-border dark:border-border-dark flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary dark:text-stone-100">Nova Transação</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-primary-50 text-text-muted"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-3 sm:p-5 lg:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Tipo *</label>
                <select className="input" {...register('type')}>
                  <option value="income">Receita</option>
                  <option value="expense">Despesa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Categoria *</label>
                <input className="input" placeholder="Ex: Vendas, Fornecedores" {...register('category')} />
                {errors.category && <p className="mt-1 text-xs text-error">{errors.category.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Valor (R$) *</label>
                <input type="number" step="0.01" className="input" placeholder="0,00" {...register('amount')} />
                {errors.amount && <p className="mt-1 text-xs text-error">{errors.amount.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Data *</label>
                <input type="date" className="input" {...register('date')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Descrição</label>
                <input className="input" placeholder="Descrição opcional" {...register('description')} />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-error" /></div>
            <h3 className="text-base font-semibold mb-2 text-text-primary dark:text-stone-100">Excluir transação?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50">
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />} Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
