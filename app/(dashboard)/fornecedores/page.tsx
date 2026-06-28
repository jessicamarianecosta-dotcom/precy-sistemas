'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { formatCurrency } from '@/lib/utils/format'
import { clsx } from 'clsx'
import {
  Truck, Plus, Search, Edit2, Trash2, X, Star, Phone, Mail,
  Globe, MapPin, Package, ShoppingCart, DollarSign, Calendar,
  Building2, Loader2, TrendingUp, TrendingDown, ChevronDown,
  AlertTriangle, CheckCircle, User, CreditCard, BarChart2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type RatingKey = 'rating_delivery' | 'rating_price' | 'rating_quality' | 'rating_service' | 'rating_punctuality'

interface Supplier {
  id: string
  company_id: string
  name: string
  legal_name?: string | null
  document?: string | null
  state_registration?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  website?: string | null
  contact_person?: string | null
  contact_role?: string | null
  zip_code?: string | null
  address?: string | null
  city?: string | null
  supplier_state?: string | null
  country?: string | null
  notes?: string | null
  is_active: boolean
  category?: string | null
  payment_terms?: string | null
  avg_delivery_days?: number | null
  min_order_value?: number | null
  freight_type?: string | null
  carrier?: string | null
  payment_methods?: string[] | null
  rating_delivery?: number | null
  rating_price?: number | null
  rating_quality?: number | null
  rating_service?: number | null
  rating_punctuality?: number | null
  rating_notes?: string | null
  created_at: string
}

interface SupplierMaterial {
  id: string
  supplier_id: string
  inventory_id?: string | null
  material_name: string
  unit: string
  current_price: number
  previous_price?: number | null
  last_purchase_date?: string | null
  is_primary: boolean
}

interface PurchaseItem {
  id: string
  material_name: string
  quantity: number
  unit: string
  unit_price: number
  subtotal: number
  inventory_id?: string | null
}

interface SupplierPurchase {
  id: string
  purchase_date: string
  expected_delivery?: string | null
  freight: number
  discount: number
  taxes: number
  subtotal: number
  total: number
  status: string
  payment_status: string
  payment_due_date?: string | null
  notes?: string | null
  items?: PurchaseItem[]
}

interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: number
  total_paid: number
}

interface PurchaseFormItem {
  inventory_id: string | null
  material_name: string
  quantity: string
  unit: string
  unit_price: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Comunicação Visual', 'Papelaria', 'Embalagens', 'Brindes',
  'Acrílico', 'MDF', 'Tintas', 'Equipamentos', 'Outros',
]

const PAYMENT_TERMS = [
  'À vista', '7 dias', '15 dias', '28 dias', '30 dias',
  '45 dias', '60 dias', '90 dias', 'Outra',
]

const PAYMENT_METHODS = ['Pix', 'Boleto', 'Cartão', 'TED', 'Outros']

const RATING_CRITERIA: { key: RatingKey; label: string }[] = [
  { key: 'rating_delivery',    label: 'Entrega'      },
  { key: 'rating_price',       label: 'Preço'        },
  { key: 'rating_quality',     label: 'Qualidade'    },
  { key: 'rating_service',     label: 'Atendimento'  },
  { key: 'rating_punctuality', label: 'Pontualidade' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined) { return formatCurrency(v) }
function safeNum(v: unknown) { return Number(v ?? 0) }

function avgRating(s: Supplier): number {
  const vals = [s.rating_delivery, s.rating_price, s.rating_quality, s.rating_service, s.rating_punctuality]
    .filter((v): v is number => v != null && v > 0)
  if (vals.length === 0) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function priceChange(current: number, previous: number | null | undefined) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct), up: pct >= 0 }
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return d }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarDisplay({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size}
          className={i <= Math.round(value) ? 'fill-warning text-warning' : 'text-border dark:text-stone-600'}
        />
      ))}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, color = 'text-primary', bg = 'bg-primary-50 dark:bg-primary/10' }: {
  icon: React.ElementType; label: string; value: string | number; color?: string; bg?: string
}) {
  return (
    <div className={clsx('rounded-xl p-3 flex items-center gap-3', bg)}>
      <div className={clsx('rounded-lg p-2 bg-white/40 dark:bg-white/5')}>
        <Icon size={15} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-text-muted dark:text-stone-500 font-medium leading-none mb-0.5">{label}</p>
        <p className={clsx('text-sm font-bold leading-none truncate', color)}>{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label?: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={13} className="text-text-muted mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        {label && <p className="text-[10px] text-text-muted leading-none mb-0.5">{label}</p>}
        <p className="text-xs text-text-primary dark:text-stone-200 break-words">{value}</p>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function FornecedoresPage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { companyId } = useCompanyId()
  const { toast } = useToast()

  // UI state
  const [view, setView] = useState<Supplier | null>(null)
  const [tab, setTab] = useState<'dados' | 'produtos' | 'compras' | 'dashboard'>('dados')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Supplier form
  const emptyForm = (): Partial<Supplier> => ({ is_active: true, country: 'Brasil', payment_methods: [] })
  const [form, setForm] = useState<Partial<Supplier>>(emptyForm())

  // Purchase form
  const emptyItem = (): PurchaseFormItem => ({ inventory_id: null, material_name: '', quantity: '1', unit: 'un', unit_price: '' })
  const [pItems, setPItems] = useState<PurchaseFormItem[]>([emptyItem()])
  const [pForm, setPForm] = useState({
    freight: '', discount: '', taxes: '',
    date: new Date().toISOString().slice(0, 10),
    expectedDelivery: '', paymentDue: '', notes: '',
  })

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('suppliers') as any)
        .select('*').eq('company_id', companyId!).order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: allPurchases = [] } = useQuery<Pick<SupplierPurchase, 'id' | 'purchase_date' | 'total' | 'payment_status'>[]>({
    queryKey: ['all-supplier-purchases', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('supplier_purchases') as any)
        .select('id, purchase_date, total, payment_status')
        .eq('company_id', companyId!)
        .order('purchase_date', { ascending: false })
      return data ?? []
    },
  })

  const { data: materials = [] } = useQuery<SupplierMaterial[]>({
    queryKey: ['supplier-materials', view?.id],
    enabled: !!view?.id,
    queryFn: async () => {
      const { data } = await (supabase.from('supplier_materials') as any)
        .select('*').eq('supplier_id', view!.id).order('material_name')
      return data ?? []
    },
  })

  const { data: purchases = [] } = useQuery<SupplierPurchase[]>({
    queryKey: ['supplier-purchases', view?.id],
    enabled: !!view?.id,
    queryFn: async () => {
      const { data } = await (supabase.from('supplier_purchases') as any)
        .select('*, items:supplier_purchase_items(*)')
        .eq('supplier_id', view!.id)
        .order('purchase_date', { ascending: false })
      return data ?? []
    },
  })

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['inventory-list', companyId],
    enabled: !!companyId && showPurchaseModal,
    queryFn: async () => {
      const { data } = await (supabase.from('inventory') as any)
        .select('id, name, unit, quantity, total_paid').eq('company_id', companyId!).order('name')
      return data ?? []
    },
  })

  // ── Global stats ──────────────────────────────────────────────────────────

  const now = new Date()
  const globalLastPurchase = allPurchases[0]
  const globalMonthTotal = allPurchases
    .filter(p => { const d = new Date(p.purchase_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    .reduce((s, p) => s + safeNum(p.total), 0)
  const globalPending = allPurchases
    .filter(p => p.payment_status === 'pending')
    .reduce((s, p) => s + safeNum(p.total), 0)

  // ── Per-supplier stats ────────────────────────────────────────────────────

  const monthPurchases = purchases.filter(p => {
    const d = new Date(p.purchase_date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthTotal = monthPurchases.reduce((s, p) => s + safeNum(p.total), 0)
  const yearTotal = purchases
    .filter(p => new Date(p.purchase_date).getFullYear() === now.getFullYear())
    .reduce((s, p) => s + safeNum(p.total), 0)
  const pendingPayment = purchases
    .filter(p => p.payment_status === 'pending')
    .reduce((s, p) => s + safeNum(p.total), 0)

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      if (filter === 'active' && !s.is_active) return false
      if (filter === 'inactive' && s.is_active) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.name.toLowerCase().includes(q) ||
          (s.email ?? '').toLowerCase().includes(q) ||
          (s.city ?? '').toLowerCase().includes(q) ||
          (s.category ?? '').toLowerCase().includes(q) ||
          (s.document ?? '').includes(q)
        )
      }
      return true
    })
  }, [suppliers, filter, search])

  // ── Save supplier ─────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name?.trim()) { toast('error', 'Nome obrigatório'); return }
    setSaving(true)
    try {
      const payload = { ...form, company_id: companyId }
      if (form.id) {
        const { error } = await (supabase.from('suppliers') as any).update(payload).eq('id', form.id)
        if (error) throw error
        if (view?.id === form.id) setView({ ...view, ...form } as Supplier)
      } else {
        const { error } = await (supabase.from('suppliers') as any).insert([payload])
        if (error) throw error
      }
      await qc.invalidateQueries({ queryKey: ['suppliers', companyId] })
      toast('success', form.id ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!')
      setShowForm(false)
    } catch (e: any) {
      toast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { error } = await (supabase.from('suppliers') as any).delete().eq('id', deleteId)
      if (error) throw error
      if (view?.id === deleteId) setView(null)
      await qc.invalidateQueries({ queryKey: ['suppliers', companyId] })
      toast('success', 'Fornecedor removido.')
    } catch (e: any) {
      toast('error', e.message)
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  // ── Purchase total ────────────────────────────────────────────────────────

  const pSubtotal = pItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  const pTotal = pSubtotal + (parseFloat(pForm.freight) || 0) - (parseFloat(pForm.discount) || 0) + (parseFloat(pForm.taxes) || 0)

  // ── Save purchase ─────────────────────────────────────────────────────────

  async function handleSavePurchase() {
    if (!view?.id) return
    const validItems = pItems.filter(i => i.material_name.trim() && parseFloat(i.quantity) > 0 && parseFloat(i.unit_price) > 0)
    if (validItems.length === 0) { toast('error', 'Adicione pelo menos um item com nome, quantidade e valor'); return }
    setSaving(true)
    try {
      // 1. Registrar compra
      const { data: purchaseData, error: pErr } = await (supabase.from('supplier_purchases') as any)
        .insert([{
          company_id: companyId,
          supplier_id: view.id,
          purchase_date: pForm.date || new Date().toISOString().slice(0, 10),
          expected_delivery: pForm.expectedDelivery || null,
          freight: parseFloat(pForm.freight) || 0,
          discount: parseFloat(pForm.discount) || 0,
          taxes: parseFloat(pForm.taxes) || 0,
          subtotal: pSubtotal,
          total: pTotal,
          status: 'pending',
          payment_status: 'pending',
          payment_due_date: pForm.paymentDue || null,
          notes: pForm.notes || null,
        }]).select().single()
      if (pErr) throw pErr
      const purchaseId = purchaseData.id

      // 2. Itens + atualizar estoque + histórico de preços
      for (const item of validItems) {
        const qty = parseFloat(item.quantity)
        const unitPrice = parseFloat(item.unit_price)

        await (supabase.from('supplier_purchase_items') as any).insert([{
          purchase_id: purchaseId,
          inventory_id: item.inventory_id || null,
          material_name: item.material_name,
          quantity: qty,
          unit: item.unit,
          unit_price: unitPrice,
          subtotal: qty * unitPrice,
        }])

        // Atualizar estoque (quantidade + custo ponderado)
        if (item.inventory_id) {
          const invItem = inventoryItems.find(i => i.id === item.inventory_id)
          if (invItem) {
            const newQty = safeNum(invItem.quantity) + qty
            const newTotalPaid = safeNum(invItem.total_paid) + qty * unitPrice
            await (supabase.from('inventory') as any)
              .update({ quantity: newQty, total_paid: newTotalPaid })
              .eq('id', item.inventory_id)
          }
        }

        // Atualizar ou criar supplier_material
        const existingMat = materials.find(m =>
          (item.inventory_id && m.inventory_id === item.inventory_id) ||
          m.material_name.toLowerCase() === item.material_name.toLowerCase()
        )
        if (existingMat) {
          await (supabase.from('supplier_materials') as any)
            .update({
              previous_price: existingMat.current_price,
              current_price: unitPrice,
              last_purchase_date: pForm.date || new Date().toISOString().slice(0, 10),
            }).eq('id', existingMat.id)
        } else {
          await (supabase.from('supplier_materials') as any).insert([{
            company_id: companyId,
            supplier_id: view.id,
            inventory_id: item.inventory_id || null,
            material_name: item.material_name,
            unit: item.unit,
            current_price: unitPrice,
            last_purchase_date: pForm.date || new Date().toISOString().slice(0, 10),
            is_primary: false,
          }])
        }

        // Histórico de preços
        await (supabase.from('material_price_history') as any).insert([{
          company_id: companyId,
          supplier_id: view.id,
          inventory_id: item.inventory_id || null,
          material_name: item.material_name,
          price: unitPrice,
          purchase_id: purchaseId,
          recorded_at: new Date().toISOString(),
        }])
      }

      // 3. Gerar conta a pagar no Financeiro
      await (supabase.from('financial_transactions') as any).insert([{
        company_id: companyId,
        type: 'expense',
        category: 'Compras',
        amount: pTotal,
        description: `Compra — ${view.name}`,
        date: pForm.paymentDue || pForm.date || new Date().toISOString().slice(0, 10),
        status: 'to_pay',
      }])

      await qc.invalidateQueries({ queryKey: ['supplier-purchases', view.id] })
      await qc.invalidateQueries({ queryKey: ['supplier-materials', view.id] })
      await qc.invalidateQueries({ queryKey: ['all-supplier-purchases', companyId] })
      await qc.invalidateQueries({ queryKey: ['inventory', companyId] })
      await qc.invalidateQueries({ queryKey: ['inventory-list', companyId] })
      await qc.invalidateQueries({ queryKey: ['financial-transactions', companyId] })

      toast('success', 'Compra registrada! Estoque e conta a pagar atualizados.')
      setShowPurchaseModal(false)
      setPItems([emptyItem()])
      setPForm({ freight: '', discount: '', taxes: '', date: new Date().toISOString().slice(0, 10), expectedDelivery: '', paymentDue: '', notes: '' })
      setTab('compras')
    } catch (e: any) {
      toast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openNew() { setForm(emptyForm()); setShowForm(true) }
  function openEdit(s: Supplier) { setForm({ ...s }); setShowForm(true) }

  function setRating(key: RatingKey, val: number) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function togglePaymentMethod(m: string) {
    setForm(f => {
      const cur = f.payment_methods ?? []
      return { ...f, payment_methods: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] }
    })
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <>
      <Header title="Fornecedores" subtitle={`${suppliers.length} cadastrados`} />

      <div className="flex h-[calc(100vh-57px)] overflow-hidden">

        {/* ── LEFT: lista ── */}
        <div className={clsx('flex-1 overflow-y-auto min-w-0', view && 'hidden lg:block')}>

          {/* Stats */}
          <div className="p-3 sm:p-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard icon={Truck}        label="Total"          value={suppliers.length}                                                  color="text-primary"      bg="bg-primary-50 dark:bg-primary/10" />
            <StatCard icon={CheckCircle}  label="Ativos"         value={suppliers.filter(s => s.is_active).length}                        color="text-success"      bg="bg-success-light dark:bg-success/10" />
            <StatCard icon={Calendar}     label="Última compra"  value={globalLastPurchase ? fmtDate(globalLastPurchase.purchase_date) : '—'} color="text-info"       bg="bg-info-light dark:bg-info/10" />
            <StatCard icon={DollarSign}   label="A pagar"        value={globalPending > 0 ? fmt(globalPending) : '—'}                     color="text-warning"      bg="bg-warning-light dark:bg-warning/10" />
          </div>

          {/* Search + filtros */}
          <div className="px-3 sm:px-4 pb-2 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input className="input pl-8 w-full text-sm" placeholder="Buscar fornecedor..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button onClick={openNew} className="btn-primary flex items-center gap-1.5 text-sm flex-shrink-0">
                <Plus size={15} /> <span className="hidden sm:inline">Novo</span>
              </button>
            </div>
            <div className="flex gap-1.5">
              {(['all', 'active', 'inactive'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    filter === f ? 'bg-primary text-white' : 'bg-primary-50 dark:bg-white/5 text-text-secondary dark:text-stone-400 hover:bg-primary/10'
                  )}>
                  {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="px-3 sm:px-4 pb-4">
            {isLoading ? (
              <div className="card p-4"><SkeletonTable rows={5} /></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Truck} title="Nenhum fornecedor cadastrado"
                description="Cadastre fornecedores para controlar compras, custos e histórico de preços."
                action={{ label: '+ Novo Fornecedor', onClick: openNew }} />
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {filtered.map(s => {
                    const avg = avgRating(s)
                    return (
                      <div key={s.id} onClick={() => { setView(s); setTab('dados') }}
                        className={clsx('card p-3 cursor-pointer hover:border-primary/30 transition-colors',
                          view?.id === s.id && 'border-primary/40 bg-primary-50/30 dark:bg-primary/5'
                        )}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-text-primary dark:text-stone-100">{s.name}</span>
                              <span className={clsx('badge text-[10px]', s.is_active ? 'badge-success' : 'badge-error')}>
                                {s.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                            {s.category && <p className="text-[10px] text-text-muted mt-0.5">{s.category}</p>}
                            {s.phone && <p className="text-xs text-text-secondary dark:text-stone-400 mt-0.5">{s.phone}</p>}
                            {avg > 0 && <div className="mt-1"><StarDisplay value={avg} size={10} /></div>}
                          </div>
                          <ChevronDown size={14} className="-rotate-90 text-text-muted flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop tabela */}
                <div className="hidden md:block card p-0 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border dark:border-border-dark">
                        {['Fornecedor', 'Contato', 'Cond. Pagto', 'Avaliação', 'Status', 'Ações'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider p-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => {
                        const avg = avgRating(s)
                        return (
                          <tr key={s.id} onClick={() => { setView(s); setTab('dados') }}
                            className={clsx(
                              'border-b border-border dark:border-border-dark last:border-0 cursor-pointer transition-colors',
                              view?.id === s.id
                                ? 'bg-primary-50/50 dark:bg-primary/5'
                                : 'hover:bg-primary-50/20 dark:hover:bg-white/[0.02]'
                            )}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Truck size={14} className="text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{s.name}</p>
                                  {s.category && <p className="text-[10px] text-text-muted">{s.category}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="text-xs text-text-secondary dark:text-stone-400">{s.phone || '—'}</p>
                              {s.email && <p className="text-[10px] text-text-muted">{s.email}</p>}
                            </td>
                            <td className="p-3">
                              <span className="text-xs text-text-secondary dark:text-stone-400">{s.payment_terms || '—'}</span>
                            </td>
                            <td className="p-3">
                              {avg > 0 ? <StarDisplay value={avg} /> : <span className="text-xs text-text-muted">—</span>}
                            </td>
                            <td className="p-3">
                              <span className={clsx('badge text-[10px]', s.is_active ? 'badge-success' : 'badge-error')}>
                                {s.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="p-3" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <button onClick={() => openEdit(s)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => setDeleteId(s.id)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                                  <Trash2 size={13} />
                                </button>
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

        {/* ── RIGHT: ficha ── */}
        {view && (
          <div className={clsx(
            'fixed inset-0 z-30 bg-background dark:bg-background-dark flex flex-col overflow-hidden',
            'lg:relative lg:inset-auto lg:z-auto lg:w-[52%] lg:max-w-2xl lg:border-l lg:border-border lg:dark:border-border-dark'
          )}>
            {/* Ficha header */}
            <div className="flex-shrink-0 p-3 sm:p-4 border-b border-border dark:border-border-dark flex items-center gap-3">
              <button onClick={() => setView(null)}
                className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted lg:hidden flex-shrink-0">
                <X size={16} />
              </button>
              <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Truck size={16} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-text-primary dark:text-stone-100 truncate">{view.name}</h2>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className={clsx('badge text-[10px]', view.is_active ? 'badge-success' : 'badge-error')}>
                    {view.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                  {view.category && <span className="badge badge-primary text-[10px]">{view.category}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(view)}
                  className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => setView(null)}
                  className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted hidden lg:flex">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 border-b border-border dark:border-border-dark px-1 flex overflow-x-auto no-scrollbar">
              {([
                { key: 'dados',     label: '📋 Dados'      },
                { key: 'produtos',  label: '📦 Produtos'   },
                { key: 'compras',   label: '🛒 Compras'    },
                { key: 'dashboard', label: '📊 Dashboard'  },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={clsx(
                    'py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
                    tab === t.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-muted dark:text-stone-500 hover:text-text-secondary'
                  )}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">

              {/* ── TAB DADOS ── */}
              {tab === 'dados' && (
                <>
                  {/* Contato */}
                  <div className="card p-3 space-y-2.5">
                    <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider">Contato</p>
                    {view.legal_name && <InfoRow icon={Building2} label="Razão Social" value={view.legal_name} />}
                    {view.document && <InfoRow icon={CreditCard} label="CPF/CNPJ" value={view.document} />}
                    {view.phone && <InfoRow icon={Phone} value={view.phone} />}
                    {view.whatsapp && view.whatsapp !== view.phone && <InfoRow icon={Phone} label="WhatsApp" value={view.whatsapp} />}
                    {view.email && <InfoRow icon={Mail} value={view.email} />}
                    {view.website && (
                      <div className="flex items-center gap-2">
                        <Globe size={13} className="text-text-muted flex-shrink-0" />
                        <a href={view.website.startsWith('http') ? view.website : `https://${view.website}`}
                          target="_blank" rel="noreferrer"
                          className="text-xs text-primary hover:underline truncate">{view.website}</a>
                      </div>
                    )}
                    {view.contact_person && (
                      <InfoRow icon={User}
                        value={view.contact_role ? `${view.contact_person} — ${view.contact_role}` : view.contact_person} />
                    )}
                  </div>

                  {/* Endereço */}
                  {(view.address || view.city || view.supplier_state) && (
                    <div className="card p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider">Endereço</p>
                      <div className="flex items-start gap-2">
                        <MapPin size={13} className="text-text-muted mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-text-secondary dark:text-stone-400 space-y-0.5">
                          {view.address && <p>{view.address}</p>}
                          <p>{[view.city, view.supplier_state, view.zip_code].filter(Boolean).join(' · ')}</p>
                          {view.country && view.country !== 'Brasil' && <p>{view.country}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comercial */}
                  <div className="card p-3 space-y-2.5">
                    <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider">Informações Comerciais</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Cond. Pagamento',  value: view.payment_terms },
                        { label: 'Prazo entrega',    value: view.avg_delivery_days ? `${view.avg_delivery_days} dias` : null },
                        { label: 'Pedido mínimo',    value: view.min_order_value ? fmt(view.min_order_value) : null },
                        { label: 'Frete',            value: view.freight_type },
                        { label: 'Transportadora',   value: view.carrier },
                      ].filter(r => r.value).map(r => (
                        <div key={r.label} className="rounded-lg p-2 bg-primary-50/50 dark:bg-white/[0.02]">
                          <p className="text-[10px] text-text-muted uppercase tracking-wider">{r.label}</p>
                          <p className="text-xs font-medium text-text-primary dark:text-stone-200 mt-0.5">{r.value}</p>
                        </div>
                      ))}
                    </div>
                    {(view.payment_methods ?? []).length > 0 && (
                      <div>
                        <p className="text-[10px] text-text-muted mb-1.5">Formas de pagamento</p>
                        <div className="flex flex-wrap gap-1">
                          {view.payment_methods!.map(m => (
                            <span key={m} className="badge badge-info text-[10px]">{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Avaliação */}
                  {RATING_CRITERIA.some(c => view[c.key] != null) && (
                    <div className="card p-3 space-y-2">
                      <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider">Avaliação</p>
                      {RATING_CRITERIA.map(c => {
                        const val = view[c.key]
                        if (!val) return null
                        return (
                          <div key={c.key} className="flex items-center justify-between">
                            <span className="text-xs text-text-secondary dark:text-stone-400">{c.label}</span>
                            <StarDisplay value={val} size={11} />
                          </div>
                        )
                      })}
                      {view.rating_notes && (
                        <p className="text-xs text-text-muted italic border-t border-border dark:border-border-dark pt-2">{view.rating_notes}</p>
                      )}
                    </div>
                  )}

                  {/* Observações */}
                  {view.notes && (
                    <div className="card p-3">
                      <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-1.5">Observações</p>
                      <p className="text-xs text-text-secondary dark:text-stone-400 leading-relaxed whitespace-pre-wrap">{view.notes}</p>
                    </div>
                  )}
                </>
              )}

              {/* ── TAB PRODUTOS ── */}
              {tab === 'produtos' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-text-primary dark:text-stone-200">{materials.length} materiais</p>
                    <button onClick={() => setShowPurchaseModal(true)}
                      className="btn-primary text-xs py-1.5 flex items-center gap-1">
                      <Plus size={12} /> Nova Compra
                    </button>
                  </div>
                  {materials.length === 0 ? (
                    <div className="card p-6 text-center">
                      <Package size={24} className="text-text-muted mx-auto mb-2" />
                      <p className="text-sm text-text-muted">Nenhum material ainda.</p>
                      <p className="text-xs text-text-muted mt-1">Registre uma compra para ver os materiais aqui.</p>
                      <button onClick={() => setShowPurchaseModal(true)}
                        className="btn-primary text-xs mt-3 mx-auto">
                        Registrar primeira compra
                      </button>
                    </div>
                  ) : materials.map(m => {
                    const change = priceChange(m.current_price, m.previous_price)
                    return (
                      <div key={m.id} className="card p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{m.material_name}</p>
                            <p className="text-[10px] text-text-muted">Unidade: {m.unit}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-primary">
                              {fmt(m.current_price)}<span className="text-[10px] text-text-muted font-normal">/{m.unit}</span>
                            </p>
                            {change && (
                              <div className={clsx('flex items-center gap-0.5 justify-end text-[10px] font-medium', change.up ? 'text-error' : 'text-success')}>
                                {change.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                {change.pct.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-4 text-[10px] text-text-muted">
                          {m.last_purchase_date && (
                            <span>Última compra: <strong className="text-text-secondary dark:text-stone-400">{fmtDate(m.last_purchase_date)}</strong></span>
                          )}
                          {m.previous_price != null && m.previous_price > 0 && (
                            <span>Anterior: <strong className="text-text-secondary dark:text-stone-400">{fmt(m.previous_price)}</strong></span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── TAB COMPRAS ── */}
              {tab === 'compras' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-text-primary dark:text-stone-200">{purchases.length} compras</p>
                    <button onClick={() => setShowPurchaseModal(true)}
                      className="btn-primary text-xs py-1.5 flex items-center gap-1">
                      <Plus size={12} /> Nova Compra
                    </button>
                  </div>

                  {/* Valor do mês */}
                  {globalMonthTotal > 0 && (
                    <div className="rounded-xl bg-info-light dark:bg-info/10 border border-info/20 p-2.5 flex items-center justify-between">
                      <span className="text-xs text-info-dark dark:text-info font-medium">Comprado este mês</span>
                      <span className="text-sm font-bold text-info-dark dark:text-info">{fmt(monthTotal)}</span>
                    </div>
                  )}

                  {purchases.length === 0 ? (
                    <div className="card p-6 text-center">
                      <ShoppingCart size={24} className="text-text-muted mx-auto mb-2" />
                      <p className="text-sm text-text-muted">Nenhuma compra registrada.</p>
                    </div>
                  ) : purchases.map(p => {
                    const expanded = expandedPurchase === p.id
                    return (
                      <div key={p.id} className="card p-0 overflow-hidden">
                        <div className="p-3 flex items-center justify-between gap-2 cursor-pointer"
                          onClick={() => setExpandedPurchase(expanded ? null : p.id)}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-text-primary dark:text-stone-100">{fmtDate(p.purchase_date)}</span>
                              <span className={clsx('badge text-[9px]',
                                p.status === 'received' ? 'badge-success' : p.status === 'cancelled' ? 'badge-error' : 'badge-warning')}>
                                {p.status === 'received' ? 'Recebido' : p.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                              </span>
                              <span className={clsx('badge text-[9px]', p.payment_status === 'paid' ? 'badge-success' : 'badge-error')}>
                                {p.payment_status === 'paid' ? 'Pago' : 'A pagar'}
                              </span>
                            </div>
                            {p.payment_due_date && (
                              <p className="text-[10px] text-text-muted mt-0.5">Venc: {fmtDate(p.payment_due_date)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-bold text-text-primary dark:text-stone-100">{fmt(p.total)}</span>
                            <ChevronDown size={13} className={clsx('text-text-muted transition-transform', expanded && 'rotate-180')} />
                          </div>
                        </div>
                        {expanded && (
                          <div className="border-t border-border dark:border-border-dark px-3 pb-3 pt-2 bg-primary-50/20 dark:bg-white/[0.01] space-y-1">
                            {(p.items ?? []).map(item => (
                              <div key={item.id} className="flex items-center justify-between text-xs">
                                <span className="text-text-secondary dark:text-stone-400">
                                  {item.material_name} — {item.quantity} {item.unit} × {fmt(item.unit_price)}
                                </span>
                                <span className="font-medium text-text-primary dark:text-stone-200">{fmt(item.subtotal)}</span>
                              </div>
                            ))}
                            {(safeNum(p.freight) > 0 || safeNum(p.discount) > 0 || safeNum(p.taxes) > 0) && (
                              <div className="pt-1 border-t border-border dark:border-border-dark space-y-0.5">
                                {safeNum(p.freight) > 0 && <div className="flex justify-between text-xs text-text-muted"><span>Frete</span><span>+{fmt(p.freight)}</span></div>}
                                {safeNum(p.discount) > 0 && <div className="flex justify-between text-xs text-success"><span>Desconto</span><span>-{fmt(p.discount)}</span></div>}
                                {safeNum(p.taxes) > 0 && <div className="flex justify-between text-xs text-text-muted"><span>Impostos</span><span>+{fmt(p.taxes)}</span></div>}
                              </div>
                            )}
                            <div className="flex justify-between text-xs font-bold text-text-primary dark:text-stone-100 pt-1 border-t border-border dark:border-border-dark">
                              <span>Total</span><span>{fmt(p.total)}</span>
                            </div>
                            {p.notes && <p className="text-[10px] text-text-muted italic pt-0.5">{p.notes}</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── TAB DASHBOARD ── */}
              {tab === 'dashboard' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard icon={DollarSign}    label="Este mês"     value={fmt(monthTotal)}      color="text-primary"  bg="bg-primary-50 dark:bg-primary/10" />
                    <StatCard icon={TrendingUp}    label="Este ano"     value={fmt(yearTotal)}       color="text-info"     bg="bg-info-light dark:bg-info/10" />
                    <StatCard icon={ShoppingCart}  label="Compras"      value={purchases.length}     color="text-success"  bg="bg-success-light dark:bg-success/10" />
                    <StatCard icon={AlertTriangle} label="A pagar"      value={fmt(pendingPayment)}  color="text-warning"  bg="bg-warning-light dark:bg-warning/10" />
                  </div>

                  {purchases[0] && (
                    <div className="card p-3">
                      <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-2">Última compra</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-text-primary dark:text-stone-200">{fmtDate(purchases[0].purchase_date)}</p>
                          {purchases[0].expected_delivery && (
                            <p className="text-[10px] text-text-muted">Entrega: {fmtDate(purchases[0].expected_delivery)}</p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-primary">{fmt(purchases[0].total)}</span>
                      </div>
                    </div>
                  )}

                  {avgRating(view) > 0 && (
                    <div className="card p-3">
                      <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-2">Avaliação Geral</p>
                      <div className="flex items-center gap-2.5">
                        <StarDisplay value={avgRating(view)} size={18} />
                        <span className="text-sm font-bold text-warning-dark dark:text-warning">{avgRating(view).toFixed(1)}</span>
                      </div>
                    </div>
                  )}

                  {materials.length > 0 && (
                    <div className="card p-3">
                      <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-2">
                        Materiais ({materials.length})
                      </p>
                      <div className="space-y-1.5">
                        {materials.slice(0, 6).map(m => (
                          <div key={m.id} className="flex items-center justify-between">
                            <span className="text-xs text-text-secondary dark:text-stone-400 truncate pr-2">{m.material_name}</span>
                            <span className="text-xs font-semibold text-primary flex-shrink-0">{fmt(m.current_price)}/{m.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {purchases.length > 0 && (
                    <div className="card p-3">
                      <p className="text-[10px] font-bold text-text-muted dark:text-stone-500 uppercase tracking-wider mb-2">Histórico de compras</p>
                      <div className="space-y-1.5">
                        {purchases.slice(0, 5).map(p => (
                          <div key={p.id} className="flex items-center justify-between">
                            <span className="text-xs text-text-secondary dark:text-stone-400">{fmtDate(p.purchase_date)}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={clsx('badge text-[9px]', p.payment_status === 'paid' ? 'badge-success' : 'badge-warning')}>
                                {p.payment_status === 'paid' ? 'Pago' : 'A pagar'}
                              </span>
                              <span className="text-xs font-semibold text-text-primary dark:text-stone-200">{fmt(p.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════
          MODAL: Cadastro / Edição de Fornecedor
      ════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark flex-shrink-0">
              <h3 className="font-bold text-text-primary dark:text-stone-100">
                {form.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              {/* Dados Gerais */}
              <section>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Dados Gerais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label">Nome Fantasia *</label>
                    <input className="input" placeholder="Ex: Fornecedor ABC"
                      value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Razão Social</label>
                    <input className="input" value={form.legal_name ?? ''} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">CPF / CNPJ</label>
                    <input className="input" value={form.document ?? ''} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Inscrição Estadual</label>
                    <input className="input" value={form.state_registration ?? ''} onChange={e => setForm(f => ({ ...f, state_registration: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Categoria</label>
                    <select className="input" value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <input className="input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">WhatsApp</label>
                    <input className="input" value={form.whatsapp ?? ''} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">E-mail</label>
                    <input className="input" type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Site</label>
                    <input className="input" placeholder="https://" value={form.website ?? ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Pessoa de Contato</label>
                    <input className="input" value={form.contact_person ?? ''} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Cargo</label>
                    <input className="input" value={form.contact_role ?? ''} onChange={e => setForm(f => ({ ...f, contact_role: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-3 pt-1">
                    <span className="text-xs text-text-secondary dark:text-stone-400">Status:</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      className={clsx('relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0',
                        form.is_active ? 'bg-success' : 'bg-border dark:bg-stone-600')}>
                      <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5',
                        form.is_active ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                    <span className="text-xs text-text-secondary dark:text-stone-400">{form.is_active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              </section>

              {/* Endereço */}
              <section>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Endereço</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">CEP</label>
                    <input className="input" value={form.zip_code ?? ''} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Endereço</label>
                    <input className="input" value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Cidade</label>
                    <input className="input" value={form.city ?? ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Estado</label>
                    <input className="input" value={form.supplier_state ?? ''} onChange={e => setForm(f => ({ ...f, supplier_state: e.target.value }))} />
                  </div>
                </div>
              </section>

              {/* Comercial */}
              <section>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Informações Comerciais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Condição de Pagamento</label>
                    <select className="input" value={form.payment_terms ?? ''} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Prazo médio de entrega (dias)</label>
                    <input className="input" type="number" min="0"
                      value={form.avg_delivery_days ?? ''}
                      onChange={e => setForm(f => ({ ...f, avg_delivery_days: parseInt(e.target.value) || undefined }))} />
                  </div>
                  <div>
                    <label className="label">Pedido Mínimo (R$)</label>
                    <input className="input" type="number" min="0" step="0.01"
                      value={form.min_order_value ?? ''}
                      onChange={e => setForm(f => ({ ...f, min_order_value: parseFloat(e.target.value) || undefined }))} />
                  </div>
                  <div>
                    <label className="label">Frete</label>
                    <input className="input" placeholder="Ex: Grátis acima de R$ 500"
                      value={form.freight_type ?? ''} onChange={e => setForm(f => ({ ...f, freight_type: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Transportadora</label>
                    <input className="input" value={form.carrier ?? ''} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label mb-2">Formas de Pagamento</label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} type="button" onClick={() => togglePaymentMethod(m)}
                        className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                          (form.payment_methods ?? []).includes(m)
                            ? 'bg-primary text-white border-primary'
                            : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/50'
                        )}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Avaliação */}
              <section>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Avaliação</p>
                <div className="space-y-2.5">
                  {RATING_CRITERIA.map(c => (
                    <div key={c.key} className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary dark:text-stone-400 w-24">{c.label}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <button key={i} type="button" onClick={() => setRating(c.key, i)}>
                            <Star size={18} className={clsx('transition-colors',
                              i <= ((form as any)[c.key] ?? 0)
                                ? 'fill-warning text-warning'
                                : 'text-border dark:text-stone-600 hover:text-warning/50'
                            )} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="label">Observações sobre a avaliação</label>
                    <textarea className="input resize-none w-full" rows={2}
                      value={form.rating_notes ?? ''}
                      onChange={e => setForm(f => ({ ...f, rating_notes: e.target.value }))} />
                  </div>
                </div>
              </section>

              {/* Observações */}
              <section>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Observações Gerais</p>
                <textarea className="input resize-none w-full" rows={3}
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </section>
            </div>

            <div className="flex-shrink-0 p-4 border-t border-border dark:border-border-dark flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {form.id ? 'Salvar alterações' : 'Cadastrar fornecedor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          MODAL: Nova Compra
      ════════════════════════════════════════════════ */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark flex-shrink-0">
              <div>
                <h3 className="font-bold text-text-primary dark:text-stone-100">Nova Compra</h3>
                {view && <p className="text-xs text-text-muted mt-0.5">{view.name}</p>}
              </div>
              <button onClick={() => setShowPurchaseModal(false)}
                className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Datas */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Data da compra</label>
                  <input className="input" type="date" value={pForm.date}
                    onChange={e => setPForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Previsão de entrega</label>
                  <input className="input" type="date" value={pForm.expectedDelivery}
                    onChange={e => setPForm(f => ({ ...f, expectedDelivery: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Vencimento (pagto)</label>
                  <input className="input" type="date" value={pForm.paymentDue}
                    onChange={e => setPForm(f => ({ ...f, paymentDue: e.target.value }))} />
                </div>
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Materiais</label>
                  <button type="button" onClick={() => setPItems(items => [...items, emptyItem()])}
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus size={11} /> Adicionar item
                  </button>
                </div>
                <div className="space-y-2">
                  {pItems.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-border dark:border-border-dark p-2.5 space-y-2">
                      <div className="flex gap-2">
                        <select className="input text-xs flex-1"
                          value={item.inventory_id ?? ''}
                          onChange={e => {
                            const invId = e.target.value
                            const inv = inventoryItems.find(i => i.id === invId)
                            setPItems(items => items.map((it, i) => i === idx ? {
                              ...it,
                              inventory_id: invId || null,
                              material_name: inv?.name ?? it.material_name,
                              unit: inv?.unit ?? it.unit,
                            } : it))
                          }}>
                          <option value="">Digitar nome manualmente...</option>
                          {inventoryItems.map(inv => (
                            <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                          ))}
                        </select>
                        {pItems.length > 1 && (
                          <button type="button"
                            onClick={() => setPItems(items => items.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {!item.inventory_id && (
                        <input className="input text-xs" placeholder="Nome do material"
                          value={item.material_name}
                          onChange={e => setPItems(items => items.map((it, i) => i === idx ? { ...it, material_name: e.target.value } : it))} />
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="label text-[10px]">Qtd</label>
                          <input className="input text-xs" type="number" min="0" step="any"
                            value={item.quantity}
                            onChange={e => setPItems(items => items.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))} />
                        </div>
                        <div>
                          <label className="label text-[10px]">Unidade</label>
                          <input className="input text-xs"
                            value={item.unit}
                            onChange={e => setPItems(items => items.map((it, i) => i === idx ? { ...it, unit: e.target.value } : it))} />
                        </div>
                        <div>
                          <label className="label text-[10px]">R$ / unidade</label>
                          <input className="input text-xs" type="number" min="0" step="any"
                            value={item.unit_price}
                            onChange={e => setPItems(items => items.map((it, i) => i === idx ? { ...it, unit_price: e.target.value } : it))} />
                        </div>
                      </div>
                      {parseFloat(item.quantity) > 0 && parseFloat(item.unit_price) > 0 && (
                        <p className="text-xs text-right text-primary font-semibold">
                          = {fmt(parseFloat(item.quantity) * parseFloat(item.unit_price))}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Extras */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Frete (R$)</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0,00"
                    value={pForm.freight} onChange={e => setPForm(f => ({ ...f, freight: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Desconto (R$)</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0,00"
                    value={pForm.discount} onChange={e => setPForm(f => ({ ...f, discount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Impostos (R$)</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0,00"
                    value={pForm.taxes} onChange={e => setPForm(f => ({ ...f, taxes: e.target.value }))} />
                </div>
              </div>

              {/* Totalizador */}
              <div className="rounded-xl bg-primary-50 dark:bg-primary/10 p-3 space-y-1.5">
                <div className="flex justify-between text-xs text-text-secondary dark:text-stone-400">
                  <span>Subtotal materiais</span><span>{fmt(pSubtotal)}</span>
                </div>
                {parseFloat(pForm.freight) > 0 && (
                  <div className="flex justify-between text-xs text-text-muted"><span>+ Frete</span><span>{fmt(parseFloat(pForm.freight))}</span></div>
                )}
                {parseFloat(pForm.discount) > 0 && (
                  <div className="flex justify-between text-xs text-success"><span>- Desconto</span><span>{fmt(parseFloat(pForm.discount))}</span></div>
                )}
                {parseFloat(pForm.taxes) > 0 && (
                  <div className="flex justify-between text-xs text-text-muted"><span>+ Impostos</span><span>{fmt(parseFloat(pForm.taxes))}</span></div>
                )}
                <div className="flex justify-between text-sm font-bold text-primary border-t border-primary/20 pt-1.5">
                  <span>Total</span><span>{fmt(pTotal)}</span>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="label">Observações</label>
                <textarea className="input resize-none w-full" rows={2}
                  value={pForm.notes} onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Info sobre automações */}
              <div className="rounded-xl bg-info-light dark:bg-info/10 border border-info/20 p-3">
                <p className="text-[11px] font-semibold text-info-dark dark:text-info mb-1">Ao registrar esta compra:</p>
                <ul className="text-[10px] text-info-dark/70 dark:text-info/70 space-y-0.5 list-disc list-inside">
                  <li>Estoque dos materiais vinculados será atualizado automaticamente</li>
                  <li>Custo unitário será recalculado por média ponderada</li>
                  <li>Histórico de preços será registrado</li>
                  <li>Conta a pagar será criada no Financeiro</li>
                </ul>
              </div>
            </div>

            <div className="flex-shrink-0 p-4 border-t border-border dark:border-border-dark flex gap-2 justify-end">
              <button onClick={() => setShowPurchaseModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSavePurchase} disabled={saving} className="btn-primary flex items-center gap-1.5">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Registrar Compra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          CONFIRM DELETE
      ════════════════════════════════════════════════ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-error-light flex items-center justify-center mx-auto">
              <Trash2 size={20} className="text-error" />
            </div>
            <div>
              <p className="font-bold text-text-primary dark:text-stone-100">Remover fornecedor?</p>
              <p className="text-sm text-text-muted mt-1">O histórico de compras e materiais vinculados também serão removidos.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl bg-error text-white text-sm font-semibold hover:bg-error/90 transition-colors flex items-center justify-center gap-1.5">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
