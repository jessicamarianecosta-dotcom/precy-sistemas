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
  Eye, Wallet, HandCoins, Layers, RefreshCw, CreditCard,
  Truck, ChevronDown, UserCog,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isToday, parseISO, subMonths, addMonths, getDaysInMonth, getDay, isBefore, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils/format'
import { nextDueFrom } from '@/lib/utils/recurring'

/* ─── Types ─── */
interface Transaction {
  id:                string
  type:              'income' | 'expense'
  category:          string
  amount:            number
  description:       string
  date:              string
  status?:           string
  client_name?:      string
  order_id?:         string | null
  notes?:            string
  recurring_bill_id?: string | null
  due_date?:          string | null
  payment_date?:      string | null
  payment_method?:    string | null
  card_name?:         string | null
  card_brand?:        string | null
  card_last4?:        string | null
  card_closing_day?:  number | null
  card_due_day?:      number | null
  expense_group_id?:  string | null
  installment_number?: number | null
  installments?:      number | null
  cost_center_id?:    string | null
  supplier_id?:        string | null
  supplier_name?:       string | null
  supplier_document?:  string | null
  supplier_phone?:      string | null
}

interface CostCenter {
  id:   string
  name: string
  color: string
  icon:  string
}

interface Supplier {
  id:       string
  name:     string
  document?: string | null
  phone?:    string | null
  email?:    string | null
  city?:     string | null
  is_active: boolean
}

type Period = 'all' | 'today' | 'week' | 'month' | 'last_month' | 'next_month' | 'custom'
type TypeFilter = 'all' | 'income' | 'expense'

type PaymentMethod = 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'transferencia' | 'boleto' | 'outro'
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix',            label: 'Pix' },
  { value: 'dinheiro',       label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito',  label: 'Cartão de Débito' },
  { value: 'transferencia',  label: 'Transferência' },
  { value: 'boleto',         label: 'Boleto' },
  { value: 'outro',          label: 'Outro' },
]

const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra']

const INSTALLMENT_QUICK_OPTIONS = [2, 3, 6, 10, 12, 24]

/** Gera a prévia das parcelas: valor dividido igualmente, ajuste de centavos na última. */
function computeInstallmentPreview(total: number, count: number, firstDueISO: string) {
  const n = Math.max(1, Math.floor(count) || 1)
  const base = Math.floor((total / n) * 100) / 100
  const firstDue = parseISO(firstDueISO || format(new Date(), 'yyyy-MM-dd'))
  let allocated = 0
  const rows: Array<{ amount: number; due_date: string }> = []
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1
    const amount = isLast ? Math.round((total - allocated) * 100) / 100 : base
    allocated += amount
    rows.push({ amount, due_date: format(addMonths(firstDue, i), 'yyyy-MM-dd') })
  }
  return rows
}

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
  return formatCurrency(v)
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
  const [calViewDate, setCalViewDate] = useState(new Date())
  const [pickStep,    setPickStep]    = useState<'start'|'end'>('start')
  const [typeFilter,  setTypeFilter] = useState<TypeFilter>('all')
  const [costCenterFilter, setCostCenterFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [search,      setSearch]     = useState('')
  const [showModal,   setShowModal]  = useState(false)
  const [editTx,      setEditTx]     = useState<Transaction | null>(null)
  const [deleteId,    setDeleteId]   = useState<string | null>(null)
  const [deleteScope, setDeleteScope] = useState<'one' | 'all'>('one')
  const [groupViewId, setGroupViewId] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [saving,      setSaving]     = useState(false)
  const [viewTx,      setViewTx]     = useState<Transaction | null>(null)
  const [confirmTx,    setConfirmTx]    = useState<Transaction | null>(null)
  const [confirmAmount, setConfirmAmount] = useState('')
  const [confirmDate,   setConfirmDate]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [confirmMethod, setConfirmMethod] = useState<PaymentMethod>('pix')
  const [confirmNotes,  setConfirmNotes]  = useState('')
  const [confirming,    setConfirming]    = useState(false)

  /* ── Form state ── */
  const [fType,     setFType]     = useState<'income' | 'expense'>('income')
  const [fCat,      setFCat]      = useState('pedidos')
  const [fAmount,   setFAmount]   = useState('')
  const [fDesc,     setFDesc]     = useState('')
  const [fDate,     setFDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fStatus,   setFStatus]   = useState('received')
  const [fClient,   setFClient]   = useState('')
  const [fNotes,    setFNotes]    = useState('')
  const [fCostCenter, setFCostCenter] = useState('')

  /* ── Form state: Fornecedor (despesa) ── */
  const [fSupplierMode,     setFSupplierMode]     = useState<'cadastrado' | 'manual'>('cadastrado')
  const [fSupplierId,       setFSupplierId]       = useState('')
  const [fSupplierSearch,   setFSupplierSearch]   = useState('')
  const [showSupplierPicker, setShowSupplierPicker] = useState(false)
  const [fSupplierName,     setFSupplierName]     = useState('')
  const [fSupplierDocument, setFSupplierDocument] = useState('')
  const [fSupplierPhone,    setFSupplierPhone]    = useState('')
  const [selectedSupplier,  setSelectedSupplier]  = useState<Supplier | null>(null)

  /* ── "+ Novo fornecedor" (cadastro rápido) ── */
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false)
  const [nsName,     setNsName]     = useState('')
  const [nsDocument, setNsDocument] = useState('')
  const [nsPhone,    setNsPhone]    = useState('')
  const [nsEmail,    setNsEmail]    = useState('')
  const [nsCity,     setNsCity]     = useState('')

  function resetSupplierForm() {
    setFSupplierMode('cadastrado'); setFSupplierId(''); setFSupplierSearch('')
    setShowSupplierPicker(false); setFSupplierName(''); setFSupplierDocument('')
    setFSupplierPhone(''); setSelectedSupplier(null)
  }

  function selectSupplier(s: Supplier) {
    setFSupplierId(s.id)
    setFSupplierName(s.name)
    setFSupplierDocument(s.document ?? '')
    setFSupplierPhone(s.phone ?? '')
    setFSupplierSearch(s.name)
    setSelectedSupplier(s)
    setShowSupplierPicker(false)
  }

  const newSupplierMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa não encontrada')
      if (!nsName.trim()) throw new Error('Informe o nome do fornecedor')
      const { data, error } = await (supabase.from('suppliers') as any)
        .insert([{
          company_id: companyId,
          name:  nsName.trim(),
          document: nsDocument.trim() || null,
          phone: nsPhone.trim() || null,
          email: nsEmail.trim() || null,
          city:  nsCity.trim() || null,
          is_active: true,
        }])
        .select()
        .single()
      if (error) throw error
      return data as Supplier
    },
    onSuccess: (newSupplier) => {
      qc.invalidateQueries({ queryKey: ['suppliers', companyId] })
      setFSupplierMode('cadastrado')
      selectSupplier(newSupplier)
      setShowNewSupplierModal(false)
      toast('success', 'Fornecedor cadastrado!')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  /* ── Form state: parcelamento (só para despesa nova) ── */
  const [fPaymentMode,   setFPaymentMode]   = useState<'avista' | 'parcelado'>('avista')
  const [fInstallments,  setFInstallments]  = useState(2)
  const [installmentRows, setInstallmentRows] = useState<Array<{ amount: number; due_date: string }>>([])
  const [fPaymentMethod, setFPaymentMethod] = useState<PaymentMethod | ''>('')
  const [fCardName,       setFCardName]       = useState('')
  const [fCardBrand,      setFCardBrand]      = useState('')
  const [fCardLast4,      setFCardLast4]      = useState('')
  const [fCardClosingDay, setFCardClosingDay] = useState('')
  const [fCardDueDay,     setFCardDueDay]     = useState('')

  function regenerateInstallmentPreview(total: number, count: number, firstDue: string) {
    setInstallmentRows(computeInstallmentPreview(total, count, firstDue))
  }

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

  /* ── Centros de custo (carregados dinamicamente — nunca lista fixa) ── */
  const { data: costCenters } = useQuery<CostCenter[]>({
    queryKey: ['cost-centers', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data, error } = await (supabase.from('cost_centers') as any)
        .select('id, name, color, icon')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error
      return (data ?? []) as CostCenter[]
    },
  })

  function getCostCenter(id?: string | null) {
    return (costCenters ?? []).find(c => c.id === id)
  }

  /* ── Fornecedores (carregados dinamicamente — mesma query key do módulo Fornecedores) ── */
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers', companyId],
    enabled:  !!companyId,
    queryFn:  async () => {
      const { data, error } = await (supabase.from('suppliers') as any)
        .select('id, name, document, phone, email, city, is_active')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as Supplier[]
    },
  })

  /* ── Filtered ── */
  const filtered = useMemo(() => {
    const now = new Date()
    return (transactions ?? []).filter(t => {
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
      if (costCenterFilter !== 'all' && t.cost_center_id !== costCenterFilter) return false
      if (supplierFilter !== 'all') {
        if (supplierFilter.startsWith('id:')) {
          if (t.supplier_id !== supplierFilter.slice(3)) return false
        } else if (supplierFilter.startsWith('name:')) {
          if (t.supplier_id || t.supplier_name !== supplierFilter.slice(5)) return false
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.category ?? '').toLowerCase().includes(q) ||
          (t.client_name ?? '').toLowerCase().includes(q) ||
          (t.supplier_name ?? '').toLowerCase().includes(q) ||
          String(t.amount).includes(q)
        )
      }
      return true
    })
  }, [transactions, period, typeFilter, costCenterFilter, supplierFilter, search, customStart, customEnd])

  /* Nomes de fornecedores informados manualmente (para o filtro) */
  const manualSupplierNames = useMemo(() => {
    const names = new Set<string>()
    ;(transactions ?? []).forEach(t => {
      if (!t.supplier_id && t.supplier_name) names.add(t.supplier_name)
    })
    return Array.from(names).sort()
  }, [transactions])

  /* ── Computed stats ── */
  const stats = useMemo(() => {
    const f = filtered

    const realInc = f.filter(t => t.type === 'income'  && (t.status === 'received' || t.status === 'paid'))
    const realExp = f.filter(t => t.type === 'expense' && (t.status === 'received' || t.status === 'paid'))
    const foreInc = f.filter(t => t.type === 'income'  && ['pending','to_pay','partial'].includes(t.status ?? ''))
    const foreExp = f.filter(t => t.type === 'expense' && ['pending','to_pay','partial'].includes(t.status ?? ''))

    const monthInc    = realInc.reduce((s,t) => s + Number(t.amount), 0)
    const monthExp    = realExp.reduce((s,t) => s + Number(t.amount), 0)
    const monthBal    = monthInc - monthExp
    const monthForeInc = foreInc.reduce((s,t) => s + Number(t.amount), 0)
    const monthForeExp = foreExp.reduce((s,t) => s + Number(t.amount), 0)

    const incCount  = realInc.length
    const ticketAvg = incCount > 0 ? monthInc / incCount : 0

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const overdueCount = (transactions ?? []).filter(t =>
      ['pending','to_pay','overdue','due'].includes(t.status ?? '') && t.date < todayStr
    ).length

    const expByCat = EXPENSE_CATS.map(c => ({
      label: c.label,
      total: realExp.filter(t => t.category === c.value).reduce((s,t) => s + Number(t.amount), 0)
    })).sort((a,b) => b.total - a.total)

    const allReal   = (transactions ?? []).filter(t => t.status === 'received' || t.status === 'paid')
    const totalRealInc = allReal.filter(t => t.type === 'income') .reduce((s,t) => s + Number(t.amount), 0)
    const totalRealExp = allReal.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
    const balance   = totalRealInc - totalRealExp

    return {
      totalRealInc, balance,
      monthInc, monthExp, monthBal,
      monthForeInc, monthForeExp,
      incCount, ticketAvg,
      overdueCount, topExpCat: expByCat[0]?.label ?? '—',
    }
  }, [filtered, transactions])

  /* ── Totais por Centro de Custo (despesas do período/filtro atual) ── */
  const costCenterTotals = useMemo(() => {
    const totals = new Map<string, number>()
    filtered.filter(t => t.type === 'expense' && t.cost_center_id).forEach(t => {
      totals.set(t.cost_center_id!, (totals.get(t.cost_center_id!) ?? 0) + Number(t.amount))
    })
    return (costCenters ?? [])
      .map(c => ({ ...c, total: totals.get(c.id) ?? 0 }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [filtered, costCenters])

  /* ── Mutations ── */
  function openNew() {
    setEditTx(null)
    setFType('income'); setFCat('pedidos'); setFAmount(''); setFDesc('')
    setFDate(format(new Date(), 'yyyy-MM-dd'))
    setFStatus('received'); setFClient(''); setFNotes(''); setFCostCenter('')
    setFPaymentMode('avista'); setFInstallments(2); setInstallmentRows([])
    setFPaymentMethod(''); setFCardName(''); setFCardBrand(''); setFCardLast4(''); setFCardClosingDay(''); setFCardDueDay('')
    resetSupplierForm()
    setShowModal(true)
  }

  function openEdit(tx: Transaction) {
    setEditTx(tx)
    setFType(tx.type); setFCat(tx.category); setFAmount(String(tx.amount))
    setFDesc(tx.description ?? ''); setFDate(tx.due_date ?? tx.date)
    setFStatus(tx.status ?? (tx.type === 'income' ? 'received' : 'paid'))
    setFClient(tx.client_name ?? ''); setFNotes(tx.notes ?? ''); setFCostCenter(tx.cost_center_id ?? '')
    setFPaymentMode('avista'); setFInstallments(tx.installments ?? 2); setInstallmentRows([])
    setFPaymentMethod((tx.payment_method as PaymentMethod) ?? '')
    setFCardName(tx.card_name ?? ''); setFCardBrand(tx.card_brand ?? ''); setFCardLast4(tx.card_last4 ?? '')
    setFCardClosingDay(tx.card_closing_day != null ? String(tx.card_closing_day) : '')
    setFCardDueDay(tx.card_due_day != null ? String(tx.card_due_day) : '')
    if (tx.supplier_id) {
      setFSupplierMode('cadastrado')
      setFSupplierId(tx.supplier_id)
      setFSupplierSearch(tx.supplier_name ?? '')
      const existing = (suppliers ?? []).find(s => s.id === tx.supplier_id)
      setSelectedSupplier(existing ?? null)
      setFSupplierName(tx.supplier_name ?? '')
      setFSupplierDocument(tx.supplier_document ?? '')
      setFSupplierPhone(tx.supplier_phone ?? '')
    } else if (tx.supplier_name) {
      setFSupplierMode('manual')
      setFSupplierId(''); setSelectedSupplier(null); setFSupplierSearch('')
      setFSupplierName(tx.supplier_name ?? '')
      setFSupplierDocument(tx.supplier_document ?? '')
      setFSupplierPhone(tx.supplier_phone ?? '')
    } else {
      resetSupplierForm()
    }
    setShowModal(true)
  }

  /* Parcelado só é oferecido ao criar uma despesa nova (não ao editar um lançamento/parcela já existente) */
  const isCreatingParceledExpense = !editTx && fType === 'expense' && fPaymentMode === 'parcelado'
  const isEditingInstallment = !!editTx?.expense_group_id

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa não encontrada')
      setSaving(true)

      const cardFields = fPaymentMethod === 'cartao_credito' ? {
        card_name: fCardName.trim() || null,
        card_brand: fCardBrand || null,
        card_last4: fCardLast4.trim() || null,
        card_closing_day: fCardClosingDay ? Number(fCardClosingDay) : null,
        card_due_day: fCardDueDay ? Number(fCardDueDay) : null,
      } : {
        card_name: null, card_brand: null, card_last4: null, card_closing_day: null, card_due_day: null,
      }

      const supplierFields = fType === 'expense' ? {
        supplier_id: fSupplierMode === 'cadastrado' && fSupplierId ? fSupplierId : null,
        supplier_name: fSupplierName.trim() || null,
        supplier_document: fSupplierDocument.trim() || null,
        supplier_phone: fSupplierPhone.trim() || null,
      } : {
        supplier_id: null, supplier_name: null, supplier_document: null, supplier_phone: null,
      }

      if (isCreatingParceledExpense) {
        const total = parseFloat(fAmount.replace(',', '.'))
        if (!total || total <= 0) throw new Error('Valor inválido')
        if (installmentRows.length < 1) throw new Error('Gere a prévia das parcelas antes de salvar')

        const expenseGroupId = crypto.randomUUID()
        const rows = installmentRows.map((row, i) => ({
          company_id:  companyId,
          type:        'expense',
          category:    fCat,
          amount:      row.amount,
          description: fDesc.trim() || null,
          date:        row.due_date,
          due_date:    row.due_date,
          payment_date: null,
          status:      'to_pay',
          client_name: null,
          notes:       fNotes.trim() || null,
          payment_method: fPaymentMethod || null,
          cost_center_id: fCostCenter || null,
          ...cardFields,
          ...supplierFields,
          expense_group_id: expenseGroupId,
          installment_number: i + 1,
          installments: installmentRows.length,
        }))
        const { error } = await (supabase.from('financial_transactions') as any).insert(rows).select()
        if (error) throw error
        return
      }

      const amount = parseFloat(fAmount.replace(',', '.'))
      if (!amount || amount <= 0) throw new Error('Valor inválido')
      const payload = {
        company_id:  companyId,
        type:        fType,
        category:    fCat,
        amount,
        description: fDesc.trim() || null,
        date:        fDate,
        due_date:    fDate,
        status:      fStatus || null,
        client_name: fType === 'income' ? (fClient.trim() || null) : null,
        notes:       fNotes.trim() || null,
        payment_method: fPaymentMethod || null,
        cost_center_id: fCostCenter || null,
        ...cardFields,
        ...supplierFields,
      }
      if (editTx?.id) {
        const { error } = await (supabase.from('financial_transactions') as any)
          .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editTx.id)
        if (error?.code === '42703') {
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
      invalidateFinancialQueries()
      toast('success', editTx ? 'Atualizado!' : 'Lançamento salvo!')
      setShowModal(false); setSaving(false)
    },
    onError: (err: Error) => { toast('error', err.message); setSaving(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: async ({ id, scope, groupId }: { id: string; scope: 'one' | 'all'; groupId?: string | null }) => {
      if (scope === 'all' && groupId) {
        const { error } = await (supabase.from('financial_transactions') as any).delete().eq('expense_group_id', groupId)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('financial_transactions') as any).delete().eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      invalidateFinancialQueries()
      toast('success', 'Removido.'); setDeleteId(null); setDeleteScope('one')
    },
    onError: (err: Error) => toast('error', err.message),
  })

  /* ── Ações rápidas: Receber / Pagar ── */
  function openConfirm(tx: Transaction) {
    setConfirmTx(tx)
    setConfirmAmount(String(tx.amount))
    setConfirmDate(format(new Date(), 'yyyy-MM-dd'))
    setConfirmMethod('pix')
    setConfirmNotes('')
  }

  function invalidateFinancialQueries() {
    qc.invalidateQueries({ queryKey: ['financial-transactions', companyId] })
    qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
    qc.invalidateQueries({ queryKey: ['fluxo-caixa', companyId] })
    qc.invalidateQueries({ queryKey: ['dre-transactions', companyId] })
    qc.invalidateQueries({ queryKey: ['financial-goals', companyId] })
    qc.invalidateQueries({ queryKey: ['goals-realized', companyId] })
    qc.invalidateQueries({ queryKey: ['projecao-payables', companyId] })
    qc.invalidateQueries({ queryKey: ['projecao-receivables', companyId] })
    qc.invalidateQueries({ queryKey: ['projecao-recurring', companyId] })
    qc.invalidateQueries({ queryKey: ['projecao-saldo-atual', companyId] })
  }

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!confirmTx) throw new Error('Lançamento não selecionado')
      const amount = parseFloat(confirmAmount.replace(',', '.'))
      if (!amount || amount <= 0) throw new Error('Valor inválido')
      setConfirming(true)
      const newStatus = confirmTx.type === 'income' ? 'received' : 'paid'
      const combinedNotes = confirmNotes.trim()
        ? (confirmTx.notes ? `${confirmTx.notes}\n${confirmNotes.trim()}` : confirmNotes.trim())
        : (confirmTx.notes ?? null)
      const payload: Record<string, unknown> = {
        amount,
        status: newStatus,
        date: confirmDate,
        payment_date: confirmDate,
        payment_method: confirmMethod,
        notes: combinedNotes,
        updated_at: new Date().toISOString(),
      }
      const { error } = await (supabase.from('financial_transactions') as any)
        .update(payload).eq('id', confirmTx.id)
      if (error?.code === '42703') {
        await (supabase.from('financial_transactions') as any)
          .update({ amount, status: newStatus }).eq('id', confirmTx.id)
      } else if (error) throw error

      // Sincronização reversa: se lançamento pertence a uma recorrência,
      // avança o next_due_date apenas se este é o ciclo atual (não um pagamento atrasado fora de ordem)
      if (confirmTx.recurring_bill_id) {
        const { data: bill } = await (supabase.from('recurring_bills') as any)
          .select('id, next_due_date, periodicity')
          .eq('id', confirmTx.recurring_bill_id)
          .single()

        if (bill && bill.next_due_date === confirmTx.date) {
          const newNextDue = nextDueFrom(new Date(bill.next_due_date + 'T00:00:00'), bill.periodicity)
          await (supabase.from('recurring_bills') as any)
            .update({ next_due_date: format(newNextDue, 'yyyy-MM-dd'), updated_at: new Date().toISOString() })
            .eq('id', bill.id)
        }
      }
    },
    onSuccess: () => {
      invalidateFinancialQueries()
      toast('success', confirmTx?.type === 'income'
        ? 'Recebimento registrado com sucesso.'
        : 'Pagamento registrado com sucesso.')
      setConfirmTx(null); setConfirming(false)
    },
    onError: (err: Error) => { toast('error', err.message); setConfirming(false) },
  })

  /* ── Category options for current type ── */
  const catOptions = fType === 'income' ? INCOME_CATS : EXPENSE_CATS
  const statusOptions = fType === 'income' ? STATUS_INCOME : STATUS_EXPENSE

  /* ── Parcelas de uma compra parcelada (para o modal "Ver parcelas") ── */
  const groupRows = useMemo(() => {
    if (!groupViewId) return []
    return (transactions ?? [])
      .filter(t => t.expense_group_id === groupViewId)
      .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0))
  }, [transactions, groupViewId])

  const groupSummary = useMemo(() => {
    const total = groupRows.reduce((s, t) => s + Number(t.amount), 0)
    const paidRows = groupRows.filter(t => t.status === 'paid')
    const totalPaid = paidRows.reduce((s, t) => s + Number(t.amount), 0)
    return {
      total,
      count: groupRows.length,
      paidCount: paidRows.length,
      pendingCount: groupRows.length - paidRows.length,
      totalPaid,
      balance: total - totalPaid,
    }
  }, [groupRows])

  /* ── Recalcular as demais parcelas não pagas do grupo, preservando a soma delas ── */
  const recalcMutation = useMutation({
    mutationFn: async () => {
      if (!editTx?.expense_group_id) throw new Error('Parcela não pertence a um grupo')
      setRecalculating(true)
      const { data: siblings, error } = await (supabase.from('financial_transactions') as any)
        .select('id, amount, status')
        .eq('expense_group_id', editTx.expense_group_id)
        .neq('id', editTx.id)
        .neq('status', 'paid')
      if (error) throw error
      const rows = (siblings ?? []) as Array<{ id: string; amount: number }>
      if (rows.length === 0) return
      const siblingsSum = rows.reduce((s, r) => s + Number(r.amount), 0)
      const base = Math.floor((siblingsSum / rows.length) * 100) / 100
      let allocated = 0
      await Promise.all(rows.map((r, i) => {
        const isLast = i === rows.length - 1
        const amount = isLast ? Math.round((siblingsSum - allocated) * 100) / 100 : base
        allocated += amount
        return (supabase.from('financial_transactions') as any)
          .update({ amount, updated_at: new Date().toISOString() })
          .eq('id', r.id)
      }))
    },
    onSuccess: () => {
      invalidateFinancialQueries()
      toast('success', 'Parcelas restantes recalculadas!')
      setRecalculating(false)
    },
    onError: (err: Error) => { toast('error', err.message); setRecalculating(false) },
  })

  return (
    <div className="page-enter">
      <Header title="Financeiro" subtitle="Central financeira integrada com pedidos e orçamentos" />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">

        {/* ── CARDS SUPERIORES ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Receitas */}
          <div className="card bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200/60 dark:border-green-800/30">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">Receitas <span className="text-[10px] text-green-500">(recebido)</span></p>
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
                <p className="text-xs font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">Despesas <span className="text-[10px] text-red-500">(pago)</span></p>
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
                <p className="text-xs font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">
                  Saldo {period === 'all' ? 'geral' : period === 'month' ? 'do mês' : period === 'next_month' ? 'próx. mês' : period === 'last_month' ? 'mês ant.' : period === 'week' ? 'da semana' : period === 'today' ? 'de hoje' : 'do período'}
                </p>
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

        {/* ── POR CENTRO DE CUSTO ── */}
        {costCenterTotals.length > 0 && (
          <div className="card p-3 sm:p-4">
            <p className="text-xs font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-3">Despesas por Centro de Custo</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {costCenterTotals.map(c => (
                <button key={c.id} type="button" onClick={() => setCostCenterFilter(c.id)}
                  className="rounded-xl border border-border dark:border-border-dark p-3 text-left hover:border-primary/40 transition-colors">
                  <p className="text-[11px] font-medium text-text-muted dark:text-stone-400 truncate">{c.icon} {c.name}</p>
                  <p className="text-sm font-bold text-error dark:text-red-400 mt-0.5">{fmt(c.total)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

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

              {showCustom && (
                <div className="fixed sm:absolute inset-x-0 sm:inset-x-auto bottom-0 sm:bottom-auto top-auto sm:top-full sm:right-0 mt-0 sm:mt-2 z-[60] sm:animate-scaleIn px-3 sm:px-0 pb-4 sm:pb-0">
                  <div className="fixed inset-0 bg-black/40 sm:hidden" onClick={() => setShowCustom(false)} />
                  <div className="relative bg-white dark:bg-[#1C1714] rounded-t-2xl sm:rounded-2xl border-t sm:border border-border dark:border-stone-800 shadow-[0_-8px_32px_rgba(0,0,0,0.3)] sm:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 space-y-3 sm:w-[320px]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-text-primary dark:text-stone-100">Período personalizado</p>
                      <button onClick={() => setShowCustom(false)}
                        className="p-1 rounded-lg text-text-muted hover:text-text-primary dark:hover:text-stone-300 hover:bg-primary-50 dark:hover:bg-white/5 transition-colors">
                        <X size={13} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'De', value: customStart, active: pickStep === 'start' },
                        { label: 'Até', value: customEnd, active: pickStep === 'end' },
                      ].map(f => (
                        <button key={f.label} type="button"
                          onClick={() => setPickStep(f.label === 'De' ? 'start' : 'end')}
                          className={clsx(
                            'flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all',
                            f.active
                              ? 'border-primary bg-primary-50 dark:bg-primary/10'
                              : 'border-border dark:border-stone-700 hover:border-primary/50'
                          )}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted dark:text-stone-500">{f.label}</span>
                          <span className="text-sm font-semibold text-text-primary dark:text-stone-100 mt-0.5">
                            {f.value ? f.value.split('-').reverse().join('/') : '—'}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Calendário */}
                    {(() => {
                      const year  = calViewDate.getFullYear()
                      const month = calViewDate.getMonth()
                      const firstDay    = new Date(year, month, 1)
                      const daysInMonth = getDaysInMonth(firstDay)
                      const startWday   = getDay(firstDay)
                      const today = format(new Date(), 'yyyy-MM-dd')

                      const cells: (number|null)[] = [
                        ...Array(startWday).fill(null),
                        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                      ]
                      while (cells.length % 7 !== 0) cells.push(null)

                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => setCalViewDate(d => subMonths(d, 1))}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors text-sm font-bold">
                              ‹
                            </button>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={month}
                                onChange={e => setCalViewDate(d => new Date(d.getFullYear(), Number(e.target.value), 1))}
                                className="text-xs font-bold text-text-primary dark:text-stone-100 bg-transparent border-none outline-none cursor-pointer hover:text-primary transition-colors capitalize"
                              >
                                {Array.from({ length: 12 }, (_, i) => (
                                  <option key={i} value={i} className="bg-white dark:bg-stone-900">
                                    {format(new Date(2000, i, 1), 'MMMM', { locale: ptBR })}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={year}
                                onChange={e => setCalViewDate(d => new Date(Number(e.target.value), d.getMonth(), 1))}
                                className="text-xs font-bold text-text-primary dark:text-stone-100 bg-transparent border-none outline-none cursor-pointer hover:text-primary transition-colors"
                              >
                                {Array.from({ length: 12 }, (_, i) => {
                                  const y = new Date().getFullYear() - 2 + i
                                  return <option key={y} value={y} className="bg-white dark:bg-stone-900">{y}</option>
                                })}
                              </select>
                            </div>
                            <button
                              onClick={() => setCalViewDate(d => addMonths(d, 1))}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors text-sm font-bold">
                              ›
                            </button>
                          </div>

                          <div className="grid grid-cols-7 mb-1">
                            {['D','S','T','Q','Q','S','S'].map((d,i) => (
                              <div key={i} className="text-center text-[9px] font-bold text-text-muted dark:text-stone-600 uppercase py-0.5">{d}</div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-px">
                            {cells.map((day, idx) => {
                              if (!day) return <div key={idx} />
                              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                              const isStart = dateStr === customStart
                              const isEnd   = dateStr === customEnd
                              const inRange = customStart && customEnd && dateStr > customStart && dateStr < customEnd
                              const isNow   = dateStr === today
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    if (pickStep === 'start') {
                                      setCustomStart(dateStr)
                                      if (dateStr > customEnd) setCustomEnd(dateStr)
                                      setPickStep('end')
                                    } else {
                                      if (dateStr < customStart) {
                                        setCustomEnd(customStart)
                                        setCustomStart(dateStr)
                                      } else {
                                        setCustomEnd(dateStr)
                                      }
                                      setPickStep('start')
                                    }
                                  }}
                                  className={clsx(
                                    'h-7 w-full rounded-lg text-[11px] font-medium transition-all',
                                    isStart || isEnd
                                      ? 'bg-primary text-white font-bold shadow-sm'
                                      : inRange
                                        ? 'bg-primary-50 dark:bg-primary/15 text-primary'
                                        : isNow
                                          ? 'ring-1 ring-primary text-primary'
                                          : 'text-text-primary dark:text-stone-200 hover:bg-primary-50 dark:hover:bg-primary/10 hover:text-primary'
                                  )}
                                >
                                  {day}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Atalhos rápidos */}
                    <div>
                      <p className="text-[10px] font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-1.5">Atalhos</p>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: 'Este mês',    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') },
                          { label: 'Próx. mês',   start: format(startOfMonth(addMonths(new Date(),1)), 'yyyy-MM-dd'), end: format(endOfMonth(addMonths(new Date(),1)), 'yyyy-MM-dd') },
                          { label: 'Mês passado', start: format(startOfMonth(subMonths(new Date(),1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(new Date(),1)), 'yyyy-MM-dd') },
                          { label: 'Últimos 30d', start: format(subMonths(new Date(),1), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
                          { label: 'Próx. 3m',    start: format(new Date(), 'yyyy-MM-dd'), end: format(endOfMonth(addMonths(new Date(),2)), 'yyyy-MM-dd') },
                          { label: 'Este ano',    start: `${new Date().getFullYear()}-01-01`, end: `${new Date().getFullYear()}-12-31` },
                        ].map(s => (
                          <button key={s.label} type="button"
                            onClick={() => {
                              setCustomStart(s.start); setCustomEnd(s.end)
                              setCalViewDate(parseISO(s.start))
                            }}
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

          {/* Centro de Custo filter */}
          <select
            className="input text-xs py-2 flex-shrink-0 w-auto max-w-[160px]"
            value={costCenterFilter}
            onChange={e => setCostCenterFilter(e.target.value)}
          >
            <option value="all">Todos os centros</option>
            {(costCenters ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>

          {/* Fornecedor filter */}
          <select
            className="input text-xs py-2 flex-shrink-0 w-auto max-w-[160px]"
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
          >
            <option value="all">Todos os fornecedores</option>
            {(suppliers ?? []).length > 0 && (
              <optgroup label="Cadastrados">
                {(suppliers ?? []).map(s => (
                  <option key={s.id} value={`id:${s.id}`}>{s.name}</option>
                ))}
              </optgroup>
            )}
            {manualSupplierNames.length > 0 && (
              <optgroup label="Informados manualmente">
                {manualSupplierNames.map(name => (
                  <option key={name} value={`name:${name}`}>{name}</option>
                ))}
              </optgroup>
            )}
          </select>

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
                  const cc     = getCostCenter(t.cost_center_id)
                  return (
                    <div key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', cat?.color ?? 'bg-stone-100 text-stone-600')}>
                              {cat?.label ?? t.category}
                            </span>
                            {cc && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-text-muted dark:text-stone-400">
                                {cc.icon} {cc.name}
                              </span>
                            )}
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1', status.badge)}>
                              <SIcon size={9} /> {status.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">
                            {t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}
                            {t.installment_number && (
                              <span className="ml-1.5 text-[10px] font-normal text-text-muted">· {t.installment_number}/{t.installments}</span>
                            )}
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
                            {t.supplier_name && (
                              <span className="text-xs text-text-muted flex items-center gap-1">
                                <Truck size={9} /> {t.supplier_name}
                                {!t.supplier_id && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800">Manual</span>
                                )}
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
                        {t.type === 'income' && ['pending','partial','overdue'].includes(t.status ?? '') && (
                          <button onClick={() => openConfirm(t)} title="Receber"
                            className="p-1.5 rounded-lg text-success-dark dark:text-green-400 hover:bg-success-light dark:hover:bg-success/10 transition-colors"><HandCoins size={13}/></button>
                        )}
                        {t.type === 'expense' && ['to_pay','due'].includes(t.status ?? '') && (
                          <button onClick={() => openConfirm(t)} title="Pagar"
                            className="p-1.5 rounded-lg text-error dark:text-red-400 hover:bg-error-light dark:hover:bg-error/10 transition-colors"><Wallet size={13}/></button>
                        )}
                        {t.expense_group_id && (
                          <button onClick={() => setGroupViewId(t.expense_group_id!)} title="Ver parcelas"
                            className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Layers size={13}/></button>
                        )}
                        <button onClick={() => setViewTx(t)} title="Visualizar" className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Eye size={13}/></button>
                        <button onClick={() => openEdit(t)} title="Editar" className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit3 size={13}/></button>
                        <button onClick={() => setDeleteId(t.id)} title="Excluir" className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={13}/></button>
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
                      {['Data','Descrição','Categoria','Centro de Custo','Fornecedor','Status','Cliente','Valor','Ações'].map(h => (
                        <th key={h} className="text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider p-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => {
                      const cat    = getCatInfo(t.category)
                      const status = getStatusInfo(t.type, t.status)
                      const SIcon  = status.icon
                      const cc     = getCostCenter(t.cost_center_id)
                      return (
                        <tr key={t.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/20 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-300 whitespace-nowrap">
                            {format(parseISO(t.date), 'dd/MM/yy', { locale: ptBR })}
                          </td>
                          <td className="p-4 max-w-[220px]">
                            <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">
                              {t.description || (t.type === 'income' ? 'Receita' : 'Despesa')}
                              {t.installment_number && (
                                <span className="ml-1.5 text-[10px] font-normal text-text-muted">· {t.installment_number}/{t.installments}</span>
                              )}
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
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-400 whitespace-nowrap">
                            {cc ? <>{cc.icon} {cc.name}</> : '—'}
                          </td>
                          <td className="p-4 text-sm text-text-secondary dark:text-stone-400 whitespace-nowrap">
                            {t.supplier_name ? (
                              <span className="flex items-center gap-1.5">
                                {t.supplier_name}
                                {!t.supplier_id && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-text-muted">Manual</span>
                                )}
                              </span>
                            ) : '—'}
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
                              {t.type === 'income' && ['pending','partial','overdue'].includes(t.status ?? '') && (
                                <button onClick={() => openConfirm(t)}
                                  title="Receber"
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-success-dark dark:text-green-400 hover:bg-success-light dark:hover:bg-success/10 transition-colors">
                                  <HandCoins size={13}/> Receber
                                </button>
                              )}
                              {t.type === 'expense' && ['to_pay','due'].includes(t.status ?? '') && (
                                <button onClick={() => openConfirm(t)}
                                  title="Pagar"
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-error dark:text-red-400 hover:bg-error-light dark:hover:bg-error/10 transition-colors">
                                  <Wallet size={13}/> Pagar
                                </button>
                              )}
                              {t.expense_group_id && (
                                <button onClick={() => setGroupViewId(t.expense_group_id!)} title="Ver parcelas" className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Layers size={13}/></button>
                              )}
                              <button onClick={() => setViewTx(t)} title="Visualizar" className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Eye size={13}/></button>
                              <button onClick={() => openEdit(t)} title="Editar" className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit3 size={13}/></button>
                              <button onClick={() => setDeleteId(t.id)} title="Excluir" className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={13}/></button>
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
                {([['income','Receita'],['expense','Despesa']] as const).map(([val, label]) => (
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

              {/* Centro de Custo */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">
                  Centro de Custo{fType === 'income' ? ' (opcional)' : ''}
                </label>
                <select className="input text-sm" value={fCostCenter} onChange={e => setFCostCenter(e.target.value)}>
                  <option value="">Selecionar...</option>
                  {(costCenters ?? []).map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Pagamento: À vista / Parcelado (só ao criar uma despesa nova) */}
              {fType === 'expense' && !editTx && (
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Pagamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([['avista','À vista'],['parcelado','Parcelado']] as const).map(([val, label]) => (
                      <button key={val} type="button"
                        onClick={() => {
                          setFPaymentMode(val)
                          if (val === 'parcelado') {
                            const total = parseFloat(fAmount.replace(',', '.')) || 0
                            regenerateInstallmentPreview(total, fInstallments, fDate)
                          } else {
                            setInstallmentRows([])
                          }
                        }}
                        className={clsx('py-2.5 rounded-xl border text-sm font-semibold transition-all',
                          fPaymentMode === val ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary' : 'border-border dark:border-border-dark text-text-muted')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recalcular parcela (só ao editar uma parcela existente) */}
              {isEditingInstallment && (
                <div className="rounded-xl border border-primary/20 bg-primary-50 dark:bg-primary/10 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-text-primary dark:text-stone-100">
                      Parcela {editTx?.installment_number}/{editTx?.installments}
                    </p>
                    <p className="text-[11px] text-text-muted">Recalcular redistribui a diferença entre as demais parcelas não pagas.</p>
                  </div>
                  <button type="button" onClick={() => recalcMutation.mutate()} disabled={recalculating}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary px-3 py-2 rounded-xl bg-white dark:bg-surface-dark border border-primary/30 whitespace-nowrap flex-shrink-0">
                    {recalculating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Recalcular parcelas restantes
                  </button>
                </div>
              )}

              {/* Valor + Data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">
                    {isCreatingParceledExpense ? 'Valor total (R$) *' : 'Valor (R$) *'}
                  </label>
                  <input type="number" step="0.01" min="0" className="input"
                    placeholder="0,00" value={fAmount}
                    onChange={e => {
                      setFAmount(e.target.value)
                      if (isCreatingParceledExpense) regenerateInstallmentPreview(parseFloat(e.target.value.replace(',', '.')) || 0, fInstallments, fDate)
                    }}
                    autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">
                    {isCreatingParceledExpense ? 'Primeiro vencimento *' : 'Vencimento *'}
                  </label>
                  <input type="date" className="input" value={fDate}
                    onChange={e => {
                      setFDate(e.target.value)
                      if (isCreatingParceledExpense) regenerateInstallmentPreview(parseFloat(fAmount.replace(',', '.')) || 0, fInstallments, e.target.value)
                    }} />
                </div>
              </div>

              {/* Quantidade de parcelas + prévia */}
              {isCreatingParceledExpense && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Quantidade de parcelas</label>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {INSTALLMENT_QUICK_OPTIONS.map(n => (
                      <button key={n} type="button"
                        onClick={() => {
                          setFInstallments(n)
                          regenerateInstallmentPreview(parseFloat(fAmount.replace(',', '.')) || 0, n, fDate)
                        }}
                        className={clsx('text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                          fInstallments === n ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-muted')}>
                        {n}x
                      </button>
                    ))}
                    <input type="number" min="1" className="input w-20 text-sm py-1.5" placeholder="Outro"
                      value={fInstallments}
                      onChange={e => {
                        const n = Math.max(1, Number(e.target.value) || 1)
                        setFInstallments(n)
                        regenerateInstallmentPreview(parseFloat(fAmount.replace(',', '.')) || 0, n, fDate)
                      }} />
                  </div>

                  {installmentRows.length > 0 && (
                    <div className="rounded-xl border border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark overflow-hidden mt-2">
                      {installmentRows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5">
                          <span className="text-[11px] font-semibold text-text-muted w-10 flex-shrink-0">{i + 1}/{installmentRows.length}</span>
                          <input type="date" className="input text-xs py-1.5 flex-1" value={row.due_date}
                            onChange={e => setInstallmentRows(rows => rows.map((r, idx) => idx === i ? { ...r, due_date: e.target.value } : r))} />
                          <input type="number" step="0.01" className="input text-xs py-1.5 w-28 flex-shrink-0" value={row.amount}
                            onChange={e => setInstallmentRows(rows => rows.map((r, idx) => idx === i ? { ...r, amount: Number(e.target.value) || 0 } : r))} />
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-2.5 bg-stone-50 dark:bg-stone-800/50 text-xs">
                        <span className="text-text-muted">Soma das parcelas</span>
                        <span className={clsx('font-bold',
                          Math.abs(installmentRows.reduce((s, r) => s + r.amount, 0) - (parseFloat(fAmount.replace(',', '.')) || 0)) < 0.01
                            ? 'text-success-dark dark:text-green-400' : 'text-error dark:text-red-400')}>
                          {fmt(installmentRows.reduce((s, r) => s + r.amount, 0))}
                        </span>
                      </div>
                    </div>
                  )}
                  <button type="button"
                    onClick={() => regenerateInstallmentPreview(parseFloat(fAmount.replace(',', '.')) || 0, fInstallments, fDate)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <RefreshCw size={12} /> Redistribuir parcelas igualmente
                  </button>
                </div>
              )}

              {/* Status */}
              {!isCreatingParceledExpense && (
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
              )}

              {/* Forma de pagamento */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Forma de pagamento</label>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.value} type="button" onClick={() => setFPaymentMethod(m.value)}
                      className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border transition-all',
                        fPaymentMethod === m.value ? 'bg-primary-50 text-primary dark:bg-primary/10 border-transparent' : 'border-border dark:border-border-dark text-text-muted')}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dados do cartão de crédito */}
              {fPaymentMethod === 'cartao_credito' && (
                <div className="rounded-xl border border-border dark:border-border-dark p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-text-primary dark:text-stone-200 flex items-center gap-1.5">
                    <CreditCard size={13} /> Dados do cartão
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input className="input text-sm" placeholder="Nome do cartão" value={fCardName} onChange={e => setFCardName(e.target.value)} />
                    <select className="input text-sm" value={fCardBrand} onChange={e => setFCardBrand(e.target.value)}>
                      <option value="">Bandeira</option>
                      {CARD_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <input className="input text-sm" placeholder="Últimos 4 dígitos" maxLength={4} value={fCardLast4} onChange={e => setFCardLast4(e.target.value.replace(/\D/g, ''))} />
                    <input type="number" min="1" max="31" className="input text-sm" placeholder="Fechamento" value={fCardClosingDay} onChange={e => setFCardClosingDay(e.target.value)} />
                    <input type="number" min="1" max="31" className="input text-sm" placeholder="Vencimento" value={fCardDueDay} onChange={e => setFCardDueDay(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Descrição</label>
                <input className="input text-sm" placeholder="Ex: Pedido PED-0042 — banner Ana"
                  value={fDesc} onChange={e => setFDesc(e.target.value)} />
              </div>

              {/* Cliente (receita) / Fornecedor (despesa) */}
              {fType === 'income' ? (
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Cliente (opcional)</label>
                  <input className="input text-sm" placeholder="Nome do cliente"
                    value={fClient} onChange={e => setFClient(e.target.value)} />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-text-primary dark:text-stone-200">Fornecedor</label>
                    <button type="button"
                      onClick={() => { setNsName(fSupplierSearch); setNsDocument(''); setNsPhone(''); setNsEmail(''); setNsCity(''); setShowNewSupplierModal(true) }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80">
                      <Plus size={11} /> Novo fornecedor
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {([['cadastrado', 'Selecionar cadastrado'], ['manual', 'Informar manualmente']] as const).map(([val, label]) => (
                      <button key={val} type="button"
                        onClick={() => setFSupplierMode(val)}
                        className={clsx('py-2 rounded-xl border text-xs font-semibold transition-all',
                          fSupplierMode === val ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary' : 'border-border dark:border-border-dark text-text-muted')}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {fSupplierMode === 'cadastrado' ? (
                    <div className="relative">
                      <input
                        type="text"
                        className="input text-sm pr-8"
                        placeholder="🔍 Digite para pesquisar..."
                        value={fSupplierSearch}
                        onFocus={() => setShowSupplierPicker(true)}
                        onChange={e => {
                          setFSupplierSearch(e.target.value)
                          setShowSupplierPicker(true)
                          if (fSupplierId) { setFSupplierId(''); setSelectedSupplier(null) }
                        }}
                        autoComplete="off"
                      />
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />

                      {showSupplierPicker && (
                        <>
                          <div className="fixed inset-0 z-[15]" onClick={() => setShowSupplierPicker(false)} />
                          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-modal max-h-48 overflow-y-auto">
                            {(suppliers ?? [])
                              .filter(s => fSupplierSearch === '' || s.name.toLowerCase().includes(fSupplierSearch.toLowerCase()))
                              .slice(0, 8)
                              .map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary/10 flex items-center justify-between gap-3 border-b border-border dark:border-border-dark last:border-0 transition-colors"
                                  onClick={() => selectSupplier(s)}
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-text-primary dark:text-stone-100 truncate">{s.name}</p>
                                    {s.city && <p className="text-[10px] text-text-muted">{s.city}</p>}
                                  </div>
                                  {s.phone && <span className="text-[11px] text-text-muted flex-shrink-0">{s.phone}</span>}
                                </button>
                              ))}
                            {(suppliers ?? []).filter(s => fSupplierSearch === '' || s.name.toLowerCase().includes(fSupplierSearch.toLowerCase())).length === 0 && (
                              <p className="text-xs text-text-muted text-center py-3">Nenhum fornecedor encontrado</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input className="input text-sm sm:col-span-1" placeholder="Fornecedor"
                        value={fSupplierName} onChange={e => setFSupplierName(e.target.value)} />
                      <input className="input text-sm" placeholder="CNPJ (opcional)"
                        value={fSupplierDocument} onChange={e => setFSupplierDocument(e.target.value)} />
                      <input className="input text-sm" placeholder="Telefone (opcional)"
                        value={fSupplierPhone} onChange={e => setFSupplierPhone(e.target.value)} />
                    </div>
                  )}

                  {fSupplierMode === 'cadastrado' && selectedSupplier && (
                    <div className="rounded-xl border border-border dark:border-border-dark p-2.5 text-[11px] text-text-muted space-y-0.5">
                      <p><b className="text-text-primary dark:text-stone-100">{selectedSupplier.name}</b></p>
                      {selectedSupplier.document && <p>CNPJ: {selectedSupplier.document}</p>}
                      {selectedSupplier.phone && <p>Telefone: {selectedSupplier.phone}</p>}
                      {selectedSupplier.email && <p>E-mail: {selectedSupplier.email}</p>}
                      {selectedSupplier.city && <p>Cidade: {selectedSupplier.city}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Observações</label>
                <textarea rows={2} className="input resize-none text-sm" placeholder="Notas extras..."
                  value={fNotes} onChange={e => setFNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => saveMutation.mutate()}
                disabled={saving || !fAmount.trim() || !fDate || (isCreatingParceledExpense && installmentRows.length === 0)}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin"/>}
                {saving ? 'Salvando...' : editTx ? 'Atualizar' : isCreatingParceledExpense ? `Criar ${installmentRows.length} parcelas` : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (() => {
        const txDel = (transactions ?? []).find(t => t.id === deleteId)
        const isGrouped = !!txDel?.expense_group_id
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm p-6 text-center animate-scaleIn">
            <div className="w-12 h-12 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-error" />
            </div>
            <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 mb-2">Excluir lançamento?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 mb-4">Esta ação não pode ser desfeita.</p>
            {isGrouped && (
              <div className="flex flex-col gap-2 mb-4 text-left">
                {([['one', 'Apenas esta parcela'], ['all', 'Todas as parcelas da compra']] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setDeleteScope(val)}
                    className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all',
                      deleteScope === val ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary font-semibold' : 'border-border dark:border-border-dark text-text-muted')}>
                    <span className={clsx('w-3.5 h-3.5 rounded-full border-2 flex-shrink-0', deleteScope === val ? 'border-primary bg-primary' : 'border-border dark:border-border-dark')} />
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteId(null); setDeleteScope('one') }} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => deleteMutation.mutate({ id: deleteId, scope: deleteScope, groupId: txDel?.expense_group_id })} disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:opacity-90 disabled:opacity-50">
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin"/>} Excluir
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ══════════════════════════════════════════════
          MODAL CONFIRMAR RECEBIMENTO / PAGAMENTO
      ══════════════════════════════════════════════ */}
      {confirmTx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !confirming && setConfirmTx(null)} />
          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-modal animate-scaleIn max-h-[92dvh] flex flex-col overflow-hidden">

            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <h2 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
                {confirmTx.type === 'income'
                  ? <><HandCoins size={17} className="text-success-dark dark:text-green-400" /> Confirmar recebimento</>
                  : <><Wallet size={17} className="text-error dark:text-red-400" /> Confirmar pagamento</>}
              </h2>
              <button onClick={() => !confirming && setConfirmTx(null)} className="p-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"><X size={15}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <p className="text-sm text-text-secondary dark:text-stone-400">
                {confirmTx.description || (confirmTx.type === 'income' ? 'Receita' : 'Despesa')}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">
                    {confirmTx.type === 'income' ? 'Valor recebido (R$) *' : 'Valor pago (R$) *'}
                  </label>
                  <input type="number" step="0.01" min="0" className="input"
                    value={confirmAmount} onChange={e => setConfirmAmount(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">
                    {confirmTx.type === 'income' ? 'Data do recebimento *' : 'Data do pagamento *'}
                  </label>
                  <input type="date" className="input" value={confirmDate} onChange={e => setConfirmDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Forma de pagamento</label>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.value} type="button" onClick={() => setConfirmMethod(m.value)}
                      className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border transition-all',
                        confirmMethod === m.value
                          ? (confirmTx.type === 'income' ? 'bg-success-light text-success-dark dark:bg-success/10 dark:text-green-400' : 'bg-error-light text-error dark:bg-error/10 dark:text-red-400') + ' border-transparent'
                          : 'border-border dark:border-border-dark text-text-muted hover:text-text-primary')}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Observações</label>
                <textarea rows={2} className="input resize-none text-sm" placeholder="Notas extras (opcional)..."
                  value={confirmNotes} onChange={e => setConfirmNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
              <button onClick={() => setConfirmTx(null)} disabled={confirming} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => confirmMutation.mutate()} disabled={confirming || !confirmAmount.trim() || !confirmDate}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {confirming && <Loader2 size={14} className="animate-spin"/>}
                {confirming ? 'Salvando...' : confirmTx.type === 'income' ? 'Confirmar Recebimento' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL VISUALIZAR (somente leitura)
      ══════════════════════════════════════════════ */}
      {viewTx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewTx(null)} />
          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-modal animate-scaleIn max-h-[92dvh] flex flex-col overflow-hidden">

            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <h2 className="text-base font-bold text-text-primary dark:text-stone-100">Detalhes do lançamento</h2>
              <button onClick={() => setViewTx(null)} className="p-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"><X size={15}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {(() => {
                const cat    = getCatInfo(viewTx.category)
                const status = getStatusInfo(viewTx.type, viewTx.status)
                const SIcon  = status.icon
                const cc     = getCostCenter(viewTx.cost_center_id)
                return (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full', cat?.color ?? 'bg-stone-100 text-stone-600')}>
                        {cat?.label ?? viewTx.category}
                      </span>
                      {cc && (
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-text-muted dark:text-stone-400">
                          {cc.icon} {cc.name}
                        </span>
                      )}
                      <span className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1', status.badge)}>
                        <SIcon size={11} /> {status.label}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-text-primary dark:text-stone-100">
                      {viewTx.description || (viewTx.type === 'income' ? 'Receita' : 'Despesa')}
                    </p>
                    <p className={clsx('text-2xl font-bold', viewTx.type === 'income' ? 'text-success-dark dark:text-green-400' : 'text-error dark:text-red-400')}>
                      {viewTx.type === 'income' ? '+' : '−'}{fmt(viewTx.amount)}
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border dark:border-border-dark">
                      <div>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider">Data</p>
                        <p className="text-sm font-medium text-text-primary dark:text-stone-200">{format(parseISO(viewTx.date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider">{viewTx.type === 'income' ? 'Cliente' : 'Fornecedor'}</p>
                        <p className="text-sm font-medium text-text-primary dark:text-stone-200">
                          {viewTx.type === 'income'
                            ? (viewTx.client_name || '—')
                            : (viewTx.supplier_name
                                ? <>{viewTx.supplier_name}{!viewTx.supplier_id && <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-text-muted">Manual</span>}</>
                                : '—')}
                        </p>
                        {viewTx.type === 'expense' && viewTx.supplier_document && (
                          <p className="text-[11px] text-text-muted mt-0.5">CNPJ: {viewTx.supplier_document}</p>
                        )}
                      </div>
                    </div>
                    {viewTx.notes && (
                      <div className="pt-2 border-t border-border dark:border-border-dark">
                        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Observações</p>
                        <p className="text-sm text-text-secondary dark:text-stone-400 whitespace-pre-wrap">{viewTx.notes}</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
              <button onClick={() => setViewTx(null)} className="btn-secondary flex-1">Fechar</button>
              <button onClick={() => { setViewTx(null); openEdit(viewTx) }} className="btn-primary flex-1">Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL VER PARCELAS (compra parcelada)
      ══════════════════════════════════════════════ */}
      {groupViewId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setGroupViewId(null)} />
          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-modal animate-scaleIn max-h-[92dvh] flex flex-col overflow-hidden">

            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
                  <Layers size={16} className="text-primary" /> {groupRows[0]?.description || 'Compra parcelada'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">{fmt(groupSummary.total)} em {groupSummary.count}x</p>
              </div>
              <button onClick={() => setGroupViewId(null)} className="p-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"><X size={15}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-border dark:border-border-dark p-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Parcelas</p>
                  <p className="text-sm font-bold text-text-primary dark:text-stone-100">{groupSummary.count}</p>
                </div>
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/30 p-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Pagas</p>
                  <p className="text-sm font-bold text-green-700 dark:text-green-400">{groupSummary.paidCount}</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 p-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Pendentes</p>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{groupSummary.pendingCount}</p>
                </div>
                <div className="rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20 p-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Saldo</p>
                  <p className="text-sm font-bold text-primary">{fmt(groupSummary.balance)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-text-muted px-1">
                <span>Total pago: <b className="text-text-primary dark:text-stone-200">{fmt(groupSummary.totalPaid)}</b></span>
              </div>

              <div className="rounded-xl border border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark overflow-hidden">
                {groupRows.map(row => (
                  <div key={row.id} className="flex items-center gap-3 p-3">
                    <div className="flex-shrink-0">
                      {row.status === 'paid'
                        ? <CheckCircle size={16} className="text-success-dark dark:text-green-400" />
                        : <span className="block w-4 h-4 rounded-full border-2 border-border dark:border-border-dark" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text-primary dark:text-stone-100">
                        {row.installment_number}/{row.installments} · {format(parseISO(row.due_date ?? row.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                      <p className="text-[11px] text-text-muted">{fmt(row.amount)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {['to_pay', 'due'].includes(row.status ?? '') && (
                        <button onClick={() => { setGroupViewId(null); openConfirm(row) }} title="Pagar"
                          className="p-1.5 rounded-lg text-error dark:text-red-400 hover:bg-error-light dark:hover:bg-error/10 transition-colors"><Wallet size={13}/></button>
                      )}
                      <button onClick={() => { setGroupViewId(null); openEdit(row) }} title="Editar"
                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"><Edit3 size={13}/></button>
                      <button onClick={() => { setGroupViewId(null); setDeleteId(row.id) }} title="Excluir"
                        className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
              <button onClick={() => setGroupViewId(null)} className="btn-secondary w-full">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL "+ NOVO FORNECEDOR" (cadastro rápido)
      ══════════════════════════════════════════════ */}
      {showNewSupplierModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNewSupplierModal(false)} />
          <div className="relative bg-white dark:bg-surface-dark w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-modal animate-scaleIn overflow-hidden">

            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark">
              <h2 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
                <Truck size={16} className="text-primary" /> Novo fornecedor
              </h2>
              <button onClick={() => setShowNewSupplierModal(false)} className="p-1.5 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"><X size={15}/></button>
            </div>

            <div className="p-4 sm:p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Nome *</label>
                <input className="input text-sm" placeholder="Nome do fornecedor" value={nsName} onChange={e => setNsName(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">CNPJ</label>
                  <input className="input text-sm" placeholder="Opcional" value={nsDocument} onChange={e => setNsDocument(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Telefone</label>
                  <input className="input text-sm" placeholder="Opcional" value={nsPhone} onChange={e => setNsPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">E-mail</label>
                  <input className="input text-sm" placeholder="Opcional" value={nsEmail} onChange={e => setNsEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary dark:text-stone-200 mb-1.5">Cidade</label>
                  <input className="input text-sm" placeholder="Opcional" value={nsCity} onChange={e => setNsCity(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark">
              <button onClick={() => setShowNewSupplierModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => newSupplierMutation.mutate()} disabled={newSupplierMutation.isPending || !nsName.trim()}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {newSupplierMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {newSupplierMutation.isPending ? 'Salvando...' : 'Salvar fornecedor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
