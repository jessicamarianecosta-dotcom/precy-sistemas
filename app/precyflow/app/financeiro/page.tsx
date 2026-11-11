'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePrecyflowCompany } from '@/hooks/usePrecyflowCompany'
import { formatCurrency } from '@/lib/utils/format'
import { PrecyflowHeader } from '@/components/precyflow/Header'
import { PrecyflowModal } from '@/components/precyflow/Modal'
import { PrecyflowEmptyState } from '@/components/precyflow/EmptyState'
import { startOfMonth } from 'date-fns'
import { format } from 'date-fns'

interface Transaction {
  id: string
  type: 'income' | 'expense'
  category: string | null
  amount: number
  description: string | null
  date: string
  status: string | null
}

function useTransactions(companyId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['precyflow-financeiro', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString()
      const { data, error } = await supabase.from('financial_transactions')
        .select('id, type, category, amount, description, date, status')
        .eq('company_id', companyId as string)
        .order('date', { ascending: false })
        .limit(100) as any
      if (error) throw error
      const all = (data ?? []) as Transaction[]
      const thisMonth = all.filter(t => t.date >= monthStart)
      const entradas = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const saidas = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      const aReceber = all.filter(t => t.type === 'income' && t.status !== 'pago').reduce((s, t) => s + Number(t.amount), 0)
      const aPagar = all.filter(t => t.type === 'expense' && t.status !== 'pago').reduce((s, t) => s + Number(t.amount), 0)
      return { all, entradas, saidas, aReceber, aPagar }
    },
  })
}

const emptyForm = { type: 'income', description: '', category: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), payment_method: '', status: 'pago' }

export default function PrecyflowFinanceiroPage() {
  const { companyId, companyName } = usePrecyflowCompany()
  const { data, isLoading } = useTransactions(companyId)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!companyId) return
    const amount = Number(form.amount.replace(',', '.'))
    if (!form.description.trim()) { setError('Informe a descrição.'); return }
    if (!form.amount || Number.isNaN(amount) || amount <= 0) { setError('Informe um valor válido.'); return }

    setSaving(true)
    setError(null)
    try {
      const { error: err } = await (supabase.from('financial_transactions') as any).insert({
        company_id: companyId,
        type: form.type,
        category: form.category.trim() || 'geral',
        amount,
        description: form.description.trim(),
        date: form.date,
        payment_method: form.payment_method.trim() || null,
        status: form.status,
      })
      if (err) throw err
      await queryClient.invalidateQueries({ queryKey: ['precyflow-financeiro', companyId] })
      setShowForm(false)
      setForm(emptyForm)
    } catch {
      setError('Não foi possível salvar o lançamento. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PrecyflowHeader title="Financeiro" subtitle={companyName} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="pf-btn-primary flex items-center gap-2 px-4 py-2.5">
            <Plus size={16} /> Novo lançamento
          </button>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pf-card h-24 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="pf-card p-4">
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--pf-text-secondary)' }}><TrendingUp size={15} /><span className="text-xs font-medium">Entradas do mês</span></div>
              <p className="text-xl font-bold text-success">{formatCurrency(data.entradas)}</p>
            </div>
            <div className="pf-card p-4">
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--pf-text-secondary)' }}><TrendingDown size={15} /><span className="text-xs font-medium">Saídas do mês</span></div>
              <p className="text-xl font-bold text-error">{formatCurrency(data.saidas)}</p>
            </div>
            <div className="pf-card p-4">
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--pf-text-secondary)' }}><Wallet size={15} /><span className="text-xs font-medium">A receber</span></div>
              <p className="text-xl font-bold">{formatCurrency(data.aReceber)}</p>
            </div>
            <div className="pf-card p-4">
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--pf-text-secondary)' }}><DollarSign size={15} /><span className="text-xs font-medium">A pagar</span></div>
              <p className="text-xl font-bold">{formatCurrency(data.aPagar)}</p>
            </div>
          </div>
        )}

        {!isLoading && data && (
          data.all.length === 0 ? (
            <div className="pf-card">
              <PrecyflowEmptyState
                icon={DollarSign}
                title="Nenhum lançamento ainda"
                subtitle="Registre entradas e saídas para acompanhar o caixa do seu negócio."
                action={<button onClick={() => setShowForm(true)} className="pf-btn-primary px-4 py-2">Novo lançamento</button>}
              />
            </div>
          ) : (
            <div className="pf-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: 'var(--pf-border)', color: 'var(--pf-text-secondary)' }}>
                    <th className="px-4 py-3 font-medium">Descrição</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.all.map(t => (
                    <tr key={t.id} className="border-b last:border-0" style={{ borderColor: 'var(--pf-border)' }}>
                      <td className="px-4 py-3">{t.description ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--pf-text-secondary)' }}>{t.category ?? '—'}</td>
                      <td className="px-4 py-3">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.status === 'pago' ? 'bg-success-light text-success-dark' : 'bg-warning-light text-warning-dark'}`}>
                          {t.status === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${t.type === 'income' ? 'text-success' : 'text-error'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showForm && (
        <PrecyflowModal title="Novo lançamento" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setForm(f => ({ ...f, type: 'income' }))}
                className={`py-2 rounded-xl text-sm font-medium border ${form.type === 'income' ? 'pf-btn-primary' : ''}`}
                style={form.type !== 'income' ? { borderColor: 'var(--pf-border)' } : undefined}
              >Entrada</button>
              <button
                onClick={() => setForm(f => ({ ...f, type: 'expense' }))}
                className={`py-2 rounded-xl text-sm font-medium border ${form.type === 'expense' ? 'pf-btn-primary' : ''}`}
                style={form.type !== 'expense' ? { borderColor: 'var(--pf-border)' } : undefined}
              >Saída</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Descrição</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Venda balcão" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Categoria</label>
                <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: vendas, materiais..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Valor (R$)</label>
                <input className="input" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Data</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Forma de pagamento</label>
              <input className="input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder="Pix, dinheiro, cartão..." />
            </div>
            {error && <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleSave} disabled={saving} className="pf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          </div>
        </PrecyflowModal>
      )}
    </div>
  )
}
