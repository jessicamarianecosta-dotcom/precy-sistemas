'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { useToast } from '@/components/ui/Toaster'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { clsx } from 'clsx'
import {
  Plus, X, Trash2, Loader2, TrendingUp, TrendingDown,
  DollarSign, ArrowUpRight, ArrowDownRight, Search,
  Filter, Edit3, CheckCircle, Clock, AlertTriangle,
  Calendar, Tag, User, ShoppingCart, FileText,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, isToday, parseISO, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/* ─── Types ─── */
interface Transaction {
  id:          string
  type:        'income' | 'expense'
  category:    string
  amount:      number
  description: string
  date:        string
  status?:     string
  client_name?: string
  order_id?:   string | null
  notes?:      string
}

type Period = 'all' | 'today' | 'week' | 'month' | 'last_month' | 'next_month' | 'custom'
type TypeFilter = 'all' | 'income' | 'expense'

/* ─── Categories ─── */
const INCOME_CATS = [
  { value: 'pedidos',   label: 'Pedidos',             color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'    },
  { value: 'vendas',    label: 'Vendas',               color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'orcamento', label: 'Orçamento aprovado',   color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'    },
  { value: 'servicos',  label: 'Serviços',             color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'outros',    label: 'Outros',               color: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'   },
]
const EXPENSE_CATS = [
  { value: 'fornecedores', label: 'Fornecedores',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'           },
  { value: 'material',     label: 'Material',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'aluguel',      label: 'Aluguel',       color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'frete',        label: 'Frete',         color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'   },
  { value: 'energia',      label: 'Energia',       color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'       },
  { value: 'marketing',    label: 'Marketing',     color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  { value: 'manutencao',   label: 'Manutenção',    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'      },
  { value: 'software',     label: 'Software/App',  color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { value: 'outros',       label: 'Outros',        color: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'      },
]
const ALL_CATS = [...INCOME_CATS, ...EXPENSE_CATS]

const STATUS_INCOME = [
  { value: 'received', label: 'Recebido',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  { value: 'partial',  label: 'Parcial',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',  icon: Clock       },
  { value: 'pending',  label: 'Pendente',  badge: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',    icon: Clock       },
  { value: 'overdue',  label: 'Atrasado',  badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',         icon: AlertTriangle },
]
const STATUS_EXPENSE = [
  { value: 'paid',    label: 'Pago',     badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  { value: 'to_pay',  label: 'A pagar',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',  icon: Clock       },
  { value: 'due',     label: 'Vencido',  badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',         icon: AlertTriangle },
]

function getCatInfo(cat: string) { return ALL_CATS.find(c => c.value === cat) }
function getStatusInfo(type: string, status?: string) {
  const list = type === 'income' ? STATUS_INCOME : STATUS_EXPENSE
  return list.find(s => s.value === status) ?? list[0]
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

/* ══════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════ */
export default function FinanceiroPage() {
  const supabase    = createClient()
  const qc          = useQueryClient()
  const { toast }   = useToast()
  const { companyId } = useCompanyId()

  /* ── UI state ── */
  const [period,      setPeriod]     = useState<Period>('month')
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customEnd,   setCustomEnd]   = useState(format(endOfMonth(new Date()),   'yyyy-MM-dd'))
  const [showCustom,  setShowCustom]  = useState(false)
  const [typeFilter,  setTypeFilter] = useState<TypeFilter>('all')
  const [search,      setSearch]     = useState('')
  const [showModal,   setShowModal]  = useState(false)
  const [editTx,      setEditTx]     = useState<Transaction | null>(null)
  const [deleteId,    setDeleteId]   = useState<string | null>(null)
  const [saving,      setSaving]     = useState(false)

  /* ── Form state ── */
  const [fType,     setFType]     = useState<'income' | 'expense'>('income')
  const [fCat,      setFCat]      = useState('pedidos')
  const [fAmount,   setFAmount]   = useState('')
  const [fDesc,     setFDesc]     = useState('')
  const [fDate,     setFDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fStatus,   setFStatus]   = useState('received')
  const [fClient,   setFClient]   = useState('')
  const [fNotes,    setFNotes]    = useState('')

  /* ── Query ── */
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ['financial-transactions', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data, error } = await (supabase.from('financial_transactions') as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
  })

  /* ── Filtered ── */
  const filtered = useMemo(() => {
    const now = new Date()
    return (transactions ?? []).filter(t => {
      // Period filter
      if (period !== 'all') {
        const d = parseISO(t.date)
        if (period === 'today'      && !isToday(d)) return false
        if (period === 'week'       && d < startOfWeek(now, { locale: ptBR })) return false
        if (period === 'month'      && (d < startOfMonth(now) || d > endOfMonth(now))) return false
        if (period === 'last_month') {
          const lm = subMonths(now, 1)
          if (d < startOfMonth(lm) || d > endOfMonth(lm)) return false
        }
        if (period === 'next_month') {
          const nm = addMonths(now, 1)
          if (d < startOfMonth(nm) || d > endOfMonth(nm)) return false
        }
        if (period === 'custom' && customStart && customEnd) {
          const start = parseISO(customStart)
          const end   = parseISO(customEnd)
          if (d < start || d > end) return false
        }
      }
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.category ?? '').toLowerCase().includes(q) ||
          (t.client_name ?? '').toLowerCase().includes(q) ||
          String(t.amount).includes(q)
        )
      }
      return true
    })
  }, [transactions, period, typeFilter, search, customStart, customEnd])

  /* ── Computed stats: REALIZADO vs PREVISTO ── */
  const stats = useMemo(() => {
    const all = transactions ?? []
    const now = new Date()

    // REALIZADOS: só status pago/recebido — impactam o caixa
    const realized = all.filter(t => t.status === 'received' || t.status === 'paid')
    // PREVISTOS: pendente/a pagar
    const forecast = all.filter(t => ['pending','to_pay','partial'].includes(t.status ?? ''))

    // Mês atual — realizados
    const monthR = realized.filter(t => {
      const d = parseISO(t.date)
      return d >= startOfMonth(now) && d <= endOfMonth(now)
    })
    const monthInc = monthR.filter(t => t.type === 'income') .reduce((s,t) => s + Number(t.amount), 0)
    const monthExp = monthR.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
    const monthBal = monthInc - monthExp

    // Previstos mês atual
    const monthForeInc = forecast.filter(t => {
      const d = parseISO(t.date)
      return t.type === 'income' && d >= startOfMonth(now) && d <= endOfMonth(now)
    }).reduce((s,t) => s + Number(t.amount), 0)
    const monthForeExp = forecast.filter(t => {
      const d = parseISO(t.date)
      return t.type === 'expense' && d >= startOfMonth(now) && d <= endOfMonth(now)
    }).reduce((s,t) => s + Number(t.amount), 0)

    // Totais gerais realizados
    const totalRealInc = realized.filter(t => t.type === 'income') .reduce((s,t) => s + Number(t.amount), 0)
    const totalRealExp = realized.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
    const balance = totalRealInc - totalRealExp

    const incCount = realized.filter(t => t.type === 'income').length
    const ticketAvg = incCount > 0 ? totalRealInc / incCount : 0

    // Atrasados: pendentes com vencimento no passado
    const todayStr = now.toISOString().split('T')[0]
    const overdueCount = all.filter(t =>
      ['pending','to_pay','overdue','due'].includes(t.status ?? '') && t.date < todayStr
    ).length

    const expByCat = EXPENSE_CATS.map(c => ({
      label: c.label,
      total: realized.filter(t => t.type === 'expense' && t.category === c.value)
               .reduce((s,t) => s + Number(t.amount), 0)
    })).sort((a,b) => b.total - a.total)

    return {
      totalRealInc, totalRealExp, balance, incCount, ticketAvg,
      monthInc, monthExp, monthBal, monthForeInc, monthForeExp,
      overdueCount, topExpCat: expByCat[0]?.label ?? '—',
    }
  }, [transactions])

  /* ── Mutations ── */
  function openNew() {
    setEditTx(null)
    setFType('income'); setFCat('pedidos'); setFAmount(''); setFDesc('')
    setFDate(format(new Date(), 'yyyy-MM-dd'))
    setFStatus('received'); setFClient(''); setFNotes('')
    setShowModal(true)
  }

  function openEdit(tx: Transaction) {
    setEditTx(tx)
    setFType(tx.type); setFCat(tx.category); setFAmount(String(tx.amount))
    setFDesc(tx.description ?? ''); setFDate(tx.date)
    setFStatus(tx.status ?? (tx.type === 'income' ? 'received' : 'paid'))
    setFClient(tx.client_name ?? ''); setFNotes(tx.notes ?? '')
    setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa não encontrada')
      const amount = parseFloat(fAmount.replace(',', '.'))
      if (!amount || amount <= 0) throw new Error('Valor inválido')
      setSaving(true)
      const payload = {
        company_id:  companyId,
        type:        fType,
        category:    fCat,
        amount,
        description: fDesc.trim() || null,
        date:        fDate,
        // Extra fields (gracious fallback if columns don't exist)
        status:      fStatus || null,
        client_name: fClient.trim() || null,
        notes:       fNotes.trim() || null,
      }
      if (editTx?.id) {
        const { error } = await (supabase.from('financial_transactions') as any)
          .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editTx.id)
        if (error?.code === '42703') {
          // Retry without extra columns
          await (supabase.from('financial_transactions') as any)
            .update({ company_id: payload.company_id, type: payload.type, category: payload.category, amount, description: payload.description, date: payload.date })
            .eq('id', editTx.id)
        } else if (error) throw error
      } else {
        const { error } = await (supabase.from('financial_transactions') as any).insert([payload]).select()
        if (error?.code === '42703') {
          await (supabase.from('financial_transactions') as any)
            .insert([{ company_id: payload.company_id, type: payload.type, category: payload.category, amount, description: payload.description, date: payload.date }]).select()
        } else if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-transactions', companyId] })
      toast('success', editTx ? 'Atualizado!' : 'Lançamento salvo!')
      setShowModal(false); setSaving(false)
    },
    onError: (err: Error) => { toast('error', err.message); setSaving(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('financial_transactions') as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-transactions', companyId] })
      toast('success', 'Removido.'); setDeleteId(null)
    },
    onError: (err: Error) => toast('error', err.message),
  })

  /* ── Category options for current type ── */
  const catOptions = fType === 'income' ? INCOME_CATS : EXPENSE_CATS
  const statusOptions = fType === 'income' ? STATUS_INCOME : STATUS_EXPENSE

  return (
    <div className="page-enter">
      <Header title="Financeiro" subtitle="Central financeira integrada com pedidos e orçamentos" />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">

        {/* ── CARDS SUPERIORES — REALIZADO VS PREVISTO ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Receitas */}
          <div className="card bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200/60 dark:border-green-800/30">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">Receitas <span className="text-green-500">(recebido)</span></p>
                <p className="text-2xl font-bold text-success-dark dark:text-green-400 mt-1">{fmt(stats.monthInc)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={18} className="text-success-dark dark:text-green-400" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-green-200/60 dark:border-green-800/20">
              <div className="text-center flex-1">
                <p className="text-[10px] text-text-muted dark:text-stone-500 uppercase tracking-wider">Qtd</p>
                <p className="text-sm font-bold text-success-dark dark:text-green-400">{stats.incCount}</p>
              </div>
              <div className="w-px h-6 bg-green-200/60 dark:bg-green-800/30" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-text-muted dark:text-stone-500 uppercase tracking-wider">Ticket médio</p>
                <p className="text-sm font-bold text-success-dark dark:text-green-400">{fmt(stats.ticketAvg)}</p>
              </div>
              <div className="w-px h-6 bg-green-200/60 dark:bg-green-800/30" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-text-muted dark:text-stone-500 uppercase tracking-wider">Previsto</p>
                <p className="text-sm font-bold text-stone-500 dark:text-stone-400">{fmt(stats.monthForeInc)}</p>
              </div>
            </div>
          </div>

          {/* Despesas */}
          <div className="card bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border-red-200/60 dark:border-red-800/30">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">Despesas <span className="text-red-500">(pago)</span></p>
                <p className="text-2xl font-bold text-error dark:text-red-400 mt-1">{fmt(stats.monthExp)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <TrendingDown size={18} className="text-error dark:text-red-400" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-red-200/60 dark:border-red-800/20">
              <div className="text-center flex-1">
                <p className="text-[10px] text-text-muted dark:text-stone-500 uppercase tracking-wider">Categoria</p>
                <p className="text-xs font-bold text-error dark:text-red-400 truncate">{stats.topExpCat}</p>
              </div>
              <div className="w-px h-6 bg-red-200/60 dark:bg-red-800/30" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-text-muted dark:text-stone-500 uppercase tracking-wider">Previsto</p>
                <p className="text-sm font-bold text-stone-500 dark:text-stone-400">{fmt(stats.monthForeExp)}</p>
              </div>
            </div>
          </div>

          {/* Saldo */}
          <div className={clsx(
            'card bg-gradient-to-br border',
            stats.balance >= 0
              ? 'from-primary-50/60 to-amber-50/40 dark:from-primary/10 dark:to-amber-900/5 border-primary/20'
              : 'from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/5 border-red-200/60 dark:border-red-800/30'
          )}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">Saldo realizado</p>
                <p className={clsx('text-2xl font-bold mt-1', stats.monthBal >= 0 ? 'text-primary' : 'text-error dark:text-red-400')}>
                  {fmt(stats.monthBal)}
                </p>
              </div>
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                stats.balance >= 0 ? 'bg-primary/10' : 'bg-red-100 dark:bg-red-900/30')}>
                <DollarSign size={18} className={stats.balance >= 0 ? 'text-primary' : 'text-error dark:text-red-400'} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-primary/10">
              <div className="text-center flex-1">
                <p className="text-[10px] text-text-muted dark:text-stone-500 uppercase tracking-wider">Lucro líquido</p>
                <p className={clsx('text-sm font-bold', stats.balance >= 0 ? 'text-primary' : 'text-error dark:text-red-400')}>
                  {fmt(stats.balance)}
                </p>
              </div>
              <div className="w-px h-6 bg-primary/10" />
              <div className="text-center flex-1">
                <p className="text-[10px] text-text-muted dark:text-stone-500 uppercase tracking-wider">Margem</p>
                <p className={clsx('text-sm font-bold', stats.balance >= 0 ? 'text-primary' : 'text-error dark:text-red-400')}>
                  {stats.totalRealInc > 0 ? ((stats.balance / stats.totalRealInc) * 100).toFixed(1) + '%' : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── TOOLBAR ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input className="input pl-9 text-sm" placeholder="Buscar por descrição, cliente, categoria..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-primary-50 dark:bg-white/[0.04] flex-shrink-0 flex-wrap">
            {([['all','Todos'],['month','Mês atual'],['next_month','Próx. mês'],['last_month','Mês ant.'],['week','Semana'],['today','Hoje']] as const).map(([k,l]) => (
              <button key={k} onClick={() => { setPeriod(k); setShowCustom(false) }}
                className={clsx('px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap',
                  period === k ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-text-muted dark:text-stone-500 hover:text-text-primary')}>
                {l}
              </button>
            ))}
            {/* Personalizado */}
            <div className="relative">
              <button
                onClick={() => { setPeriod('custom'); setShowCustom(s => !s) }}
                className={clsx('px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 whitespace-nowrap',
                  period === 'custom'
                    ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                    : 'text-text-muted dark:text-stone-500 hover:text-text-primary'
                )}
              >
                <Calendar size={11} />
                {period === 'custom'
                  ? `${customStart.split('-').reverse().slice(0,2).join('/')} → ${customEnd.split('-').reverse().slice(0,2).join('/')}`
                  : 'Personalizado'
                }
              </button>

              {/* Date range popover */}
              {showCustom && (
                <div className="absolute top-full right-0 mt-2 z-50 animate-scaleIn"
                  style={{ minWidth: '280px' }}>
                  <div className="bg-white dark:bg-[#1C1714] rounded-2xl border border-border dark:border-stone-800 shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-text-primary dark:text-stone-100">Período personalizado</p>
                      <button onClick={() => setShowCustom(false)}
                        className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-1">De</label>
                        <input
                          type="date"
                          className="input text-sm py-2"
                          value={customStart}
                          max={customEnd}
                          onChange={e => setCustomStart(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-1">Até</label>
                        <input
                          type="date"
                          className="input text-sm py-2"
                          value={customEnd}
                          min={customStart}
                          onChange={e => setCustomEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    {/* Atalhos rápidos */}
                    <div>
                      <p className="text-[10px] font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-1.5">Atalhos</p>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: 'Esta semana',   start: format(startOfWeek(new Date(), { locale: ptBR }), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
                          { label: 'Este mês',      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') },
                          { label: 'Mês passado',   start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') },
                          { label: 'Próx. mês',     start: format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd') },
                          { label: 'Últimos 30d',   start: format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
                          { label: 'Últimos 90d',   start: format(new Date(Date.now() - 90 * 86400000), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
                        ].map(s => (
                          <button key={s.label}
                            onClick={() => { setCustomStart(s.start); setCustomEnd(s.end) }}
                            className="text-[10px] font-medium px-2 py-1 rounded-lg border border-border dark:border-stone-700 text-text-muted dark:text-stone-400 hover:border-primary hover:text-primary transition-all whitespace-nowrap">
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setShowCustom(false); setPeriod('all') }}
                        className="btn-secondary flex-1 text-xs py-2">Limpar</button>
                      <button onClick={() => setShowCustom(false)}
                        className="btn-primary flex-1 text-xs py-2">Aplicar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-primary-50 dark:bg-white/[0.04] flex-shrink-0">
            {([['all','Todos'],['income','Receitas'],['expense','Despesas']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setTypeFilter(k)}
                className={clsx('px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all',
                  typeFilter === k ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-text-muted dark:text-stone-500 hover:text-text-primary')}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={openNew} className="btn-primary flex items-center gap-1.5 text-sm px-4 flex-shrink-0">
            <Plus size={15} /> Novo lançamento
          </button>
        </div>

        {/* ── TABELA / LISTA ── */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={DollarSign} title="Nenhum lançamento"
              description="Registre receitas e despesas para acompanhar o financeiro."
              action={{ label: '+ Novo lançamento', onClick: openNew }} />
          ) : (
            <>
              {/* Mobile list */}
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {filtered.map(t => {
                  const cat    = getCatInfo(t.category)
                  const status = getStatusInfo(t.type, t.status)
                  const SIcon  = status.icon
                  return (
                    <div key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', cat?.color ?? 'bg-stone-100 text-stone-600')}>
                              {cat?.label ?? t.category}
                            </span>
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1', status.badge)}>
                              <SIcon size={9} /> {status.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100 truncate">
                            {t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-text-muted">
                              {format(parseISO(t.date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            {t.client_name && (
                              <span className="text-xs text-text-muted flex items-center gap-0.5">
                                <User size={9} /> {t.client_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={clsx('text-base font-bold', t.type === 'income' ? 'text-success-dark dark:text-green-400' : 'text-error dark:text-red-400')}>
                            {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit3 size={13}/></button>
                        <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                      {['Data','Descrição','Categoria','Status','Cliente','Valor','Ações'].map(h => (
                        <th key={h} className="text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider p-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => {
                      const cat    = getCatInfo(t.category)
                      const status = getStatusInfo(t.type, t.status)
                      const SIcon  = status.icon
                      return (
                        <tr key={t.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/20 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-300 whitespace-nowrap">
                            {format(parseISO(t.date), 'dd/MM/yy', { locale: ptBR })}
                          </td>
                          <td className="p-4 max-w-[220px]">
                            <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">
                              {t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}
                            </p>
                            {t.order_id && (
                              <span className="text-[10px] text-text-muted flex items-center gap-0.5 mt-0.5">
                                <ShoppingCart size={9} /> Pedido vinculado
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={clsx('text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap', cat?.color ?? 'bg-stone-100 text-stone-600')}>
                              {cat?.label ?? t.category}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={clsx('text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 w-fit whitespace-nowrap', status.badge)}>
                              <SIcon size={10} /> {status.label}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-400">
                            {t.client_name || '—'}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {t.type === 'income'
                                ? <ArrowUpRight size={14} className="text-success-dark dark:text-green-400" />
                                : <ArrowDownRight size={14} className="text-error dark:text-red-400" />}
                              <span className={clsx('text-sm font-bold', t.type === 'income' ? 'text-success-dark dark:text-green-400' : 'text-error dark:text-red-400')}>
                                {fmt(t.amount)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit3 size={13}/></button>
                              <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={13}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── Resumo do período ── */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Receitas', value: filtered.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0), color:'text-success-dark dark:text-green-400' },
              { label: 'Despesas', value: filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0), color:'text-error dark:text-red-400' },
              { label: 'Saldo',    value: filtered.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0) - filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0), color:'text-primary' },
            ].map(s => (
              <div key={s.label} className="card py-3 text-center">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">{s.label}</p>
                <p className={clsx('text-base font-bold', s.color)}>{fmt(s.value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          MODAL NOVO / EDITAR
      ══════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-modal animate-scaleIn max-h-[92dvh] flex flex-col overflow-hidden">

            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <h2 className="text-base font-bold text-text-primary dark:text-stone-100">
                {editTx ? 'Editar lançamento' : 'Novo lançamento'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"><X size={15}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Tipo */}
              <div className="grid grid-cols-2 gap-2">
                {([['income','Receita','TrendingUp'],['expense','Despesa','TrendingDown']] as const).map(([val, label, _]) => (
                  <button key={val} type="button" onClick={() => { setFType(val); setFCat(val === 'income' ? 'pedidos' : 'fornecedores'); setFStatus(val === 'income' ? 'received' : 'to_pay') }}
                    className={clsx('flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all',
                      fType === val
                        ? val === 'income'
                          ? 'border-success bg-success-light dark:bg-success/10 text-success-dark dark:text-green-400'
                          : 'border-error bg-error-light dark:bg-error/10 text-error dark:text-red-400'
                        : 'border-border dark:border-border-dark text-text-muted')}>
                    {val === 'income' ? <TrendingUp size={15}/> : <TrendingDown size={15}/>}
                    {label}
                  </button>
                ))}
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Categoria *</label>
                <div className="flex flex-wrap gap-1.5">
                  {catOptions.map(c => (
                    <button key={c.value} type="button" onClick={() => setFCat(c.value)}
                      className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border transition-all',
                        fCat === c.value ? c.color + ' border-transparent' : 'border-border dark:border-border-dark text-text-muted hover:text-text-primary')}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor + Data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Valor (R$) *</label>
                  <input type="number" step="0.01" min="0" className="input"
                    placeholder="0,00" value={fAmount} onChange={e => setFAmount(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Vencimento *</label>
                  <input type="date" className="input" value={fDate} onChange={e => setFDate(e.target.value)} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map(s => {
                    const SIcon = s.icon
                    return (
                      <button key={s.value} type="button" onClick={() => setFStatus(s.value)}
                        className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border transition-all flex items-center gap-1',
                          fStatus === s.value ? s.badge + ' border-transparent' : 'border-border dark:border-border-dark text-text-muted')}>
                        <SIcon size={10} /> {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Descrição</label>
                <input className="input text-sm" placeholder="Ex: Pedido PED-0042 — banner Ana"
                  value={fDesc} onChange={e => setFDesc(e.target.value)} />
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Cliente (opcional)</label>
                <input className="input text-sm" placeholder="Nome do cliente"
                  value={fClient} onChange={e => setFClient(e.target.value)} />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Observações</label>
                <textarea rows={2} className="input resize-none text-sm" placeholder="Notas extras..."
                  value={fNotes} onChange={e => setFNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => saveMutation.mutate()} disabled={saving || !fAmount.trim() || !fDate}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin"/>}
                {saving ? 'Salvando...' : editTx ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-6 text-center animate-scaleIn">
            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-error" />
            </div>
            <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-2">Excluir lançamento?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50">
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin"/>} Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
