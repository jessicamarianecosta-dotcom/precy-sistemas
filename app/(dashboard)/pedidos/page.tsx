'use client'

import { useEffect, useState } from 'react'

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

import { useToast } from '@/components/ui/Toaster'

import { useCompanyId } from '@/hooks/useCompanyId'

import { Header } from '@/components/layout/Header'

import { SkeletonTable } from '@/components/ui/Skeleton'

import { EmptyState } from '@/components/ui/EmptyState'

import {
  ShoppingCart,
  Plus,
  Search,
  X,
  Loader2,
  GripVertical,
  Trash2,
  CalendarDays,
  User,
  DollarSign,
  FileText,
  Package,
  Edit2,
  ChevronDown,
  CreditCard,
  Clock,
  LayoutList,
  LayoutGrid,
  History,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Download,
  Eye,
  Percent,
  UserPlus,
  UserCheck,
  Ruler,
  Scissors,
  Box,
  ChevronUp,
} from 'lucide-react'

import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { z } from 'zod'

import { clsx } from 'clsx'

import { format, parseISO } from 'date-fns'

import { ptBR } from 'date-fns/locale'
import { formatCurrency as fmtGlobal } from '@/lib/utils/format'
import { useSubscription } from '@/hooks/useSubscription'
import { recalcOrderPaymentStatus, recalcCustomerTotalPurchases } from '@/lib/orders/recalc'
import { OrderFilesSection } from '@/components/orders/OrderFilesSection'

/* ─────────────────────────────────────────────
   STATUS
───────────────────────────────────────────── */

const STATUS_COLUMNS = [
  {
    id: 'pending',
    label: 'Pendente',
    color:
      'bg-warning-light dark:bg-warning/10 border-warning/20',
  },

  {
    id: 'production',
    label: 'Produção',
    color:
      'bg-info-light dark:bg-info/10 border-info/20',
  },

  {
    id: 'ready',
    label: 'Pronto',
    color:
      'bg-success-light dark:bg-success/10 border-success/20',
  },

  {
    id: 'delivered',
    label: 'Entregue',
    color:
      'bg-primary-50 dark:bg-primary/10 border-primary/20',
  },
]

const STATUS_COLUMNS_MOBILE = [
  ...STATUS_COLUMNS,
  {
    id: 'cancelled',
    label: 'Cancelado',
    color: 'bg-error-light dark:bg-error/10 border-error/20',
  },
]

/* ─────────────────────────────────────────────
   SCHEMA – ORDER
───────────────────────────────────────────── */

const schema = z.object({
  customer_id: z.string().min(1, 'Selecione ou cadastre um cliente'),
  service_name: z.string().optional(),
  description: z.string().optional(),
  status: z.string().default('pending'),
  subtotal: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  delivery_fee: z.coerce.number().min(0).default(0),
  additional_charges: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
  notes: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.string().default('normal'),
  payment_method: z.string().optional(),
  product_id: z.string().optional(),
  order_date: z.string().optional(),
})

type FormData = z.infer<typeof schema>

/* ─────────────────────────────────────────────
   ITENS DO PEDIDO (carrinho)
───────────────────────────────────────────── */

interface OrderItem {
  id: string
  product_id?: string
  name: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  discount_type: 'amount' | 'percentage'
  subtotal: number
  width?: number
  height?: number
  area?: number
  measurement_unit?: string
  finishings?: string[]
  finishing_type?: string
  technical_notes?: string
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function computeItemSubtotal(item: Pick<OrderItem, 'quantity' | 'unit_price' | 'discount' | 'discount_type'>): number {
  const gross = Number(item.quantity) * Number(item.unit_price)
  const disc = item.discount_type === 'percentage'
    ? gross * (Number(item.discount) / 100)
    : Number(item.discount)
  return Math.max(0, gross - disc)
}

const FINISHING_TYPE_OPTIONS = [
  'Em cartela', 'Em folhas', 'Em bobina', 'Dobrado', 'Enrolado', 'Recortado',
  'Separado por kits', 'Embalado individualmente', 'Embalado em pacote',
  'Instalado', 'Aplicado', 'Com ilhós', 'Com bastão', 'Com bainha',
  'Sem finalização', 'Outros',
]

/* ─────────────────────────────────────────────
   SCHEMA – PAYMENT HISTORY
───────────────────────────────────────────── */

const paymentSchema = z.object({
  fill_type: z.enum(['amount', 'percentage']).default('amount'),
  amount: z.coerce.number().min(0.01, 'Informe um valor'),
  percentage: z.coerce.number().min(0).optional(),
  payment_date: z.string().min(1, 'Informe a data'),
  payment_method: z.string().optional(),
  observation: z.string().optional(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function formatCurrency(v: number) {
  return fmtGlobal(v)
}

/** Converte texto digitado (aceita vírgula ou ponto como decimal) para número. */
function parseDecimalPtBR(text: string): number {
  if (!text) return 0
  const n = parseFloat(text.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Formata um número para exibição no padrão BR (vírgula decimal), sem separador de milhar. */
function formatDecimalPtBR(n: number): string {
  if (!Number.isFinite(n) || n === 0) return ''
  return (Math.round(n * 100) / 100).toString().replace('.', ',')
}

/** Sanitiza a digitação: mantém apenas dígitos e uma única vírgula. */
function sanitizeDecimalTyping(raw: string): string {
  const onlyDigitsAndComma = raw.replace(/[^\d,]/g, '')
  const [intPart, ...rest] = onlyDigitsAndComma.split(',')
  return rest.length > 0 ? `${intPart},${rest.join('')}` : onlyDigitsAndComma
}

function formatMethod(m?: string | null) {
  if (!m) return ''
  const map: Record<string, string> = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    cartao_credito: 'Cartão Crédito',
    cartao_debito: 'Cartão Débito',
    transferencia: 'Transferência',
    boleto: 'Boleto',
    outro: 'Outro',
  }
  return map[m] ?? m
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */

export default function PedidosPage() {
  const supabase = createClient()

  const queryClient = useQueryClient()

  const { toast } = useToast()

  const { companyId } = useCompanyId()
  const { data: sub } = useSubscription()

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)

  /* Mobile view */
  const [mobileView, setMobileView] = useState<'list' | 'kanban'>('list')
  const [mobileDragging, setMobileDragging] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('precy_pedidos_mobile_view')
      if (saved === 'list' || saved === 'kanban') setMobileView(saved)
    } catch { /* ignore */ }
  }, [])

  function handleSetMobileView(v: 'list' | 'kanban') {
    setMobileView(v)
    try { localStorage.setItem('precy_pedidos_mobile_view', v) } catch { /* ignore */ }
  }

  /* Desktop view (Kanban x Lista) */
  const [desktopView, setDesktopView] = useState<'kanban' | 'list'>('kanban')
  const [listSort, setListSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'created_at', dir: 'desc' })
  const [listStatusFilter, setListStatusFilter] = useState<string>('all')
  const [listPage, setListPage] = useState(1)
  const LIST_PAGE_SIZE = 20

  useEffect(() => {
    try {
      const saved = localStorage.getItem('precy_pedidos_desktop_view')
      if (saved === 'list' || saved === 'kanban') setDesktopView(saved)
    } catch { /* ignore */ }
  }, [])

  function handleSetDesktopView(v: 'kanban' | 'list') {
    setDesktopView(v)
    try { localStorage.setItem('precy_pedidos_desktop_view', v) } catch { /* ignore */ }
  }

  function toggleListSort(key: string) {
    setListSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  /* Cliente: cadastrado x novo */
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    name: '', phone: '', email: '', cpf_cnpj: '', address: '', city: '', notes: '',
  })

  /* Carrinho de itens do pedido */
  const [items, setItems] = useState<OrderItem[]>([])
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [showItemTechDetails, setShowItemTechDetails] = useState(false)

  /* Product picker (para adicionar itens ao carrinho) */
  const [productSearch, setProductSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)

  /* Payment registration modal */
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)
  const [viewingPaymentId, setViewingPaymentId] = useState<string | null>(null)
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null)
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null)

  /* Texto exibido nos campos de Valor/Porcentagem do modal de recebimento (aceita vírgula) */
  const [amountDisplayText, setAmountDisplayText] = useState('')
  const [percentageDisplayText, setPercentageDisplayText] = useState('')
  const [companyData, setCompanyData] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    async function loadCompany() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const r: any = await supabase.from('companies').select('*').eq('user_id', user.id).single()
      if (r?.data?.id) setCompanyData(r.data)
    }
    loadCompany()
  }, [])

  /* ─────────────────────────────────────────────
     QUERIES
  ───────────────────────────────────────────── */

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const response: any = await supabase
        .from('orders')
        .select('*, customers(name, phone)')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      return response?.data ?? []
    },
  })

  /* Soma de recebimentos por pedido — usada apenas na visão em Lista
     (colunas Recebido/Saldo). Carregada sob demanda para não pesar o Kanban. */
  const { data: paymentsByOrder } = useQuery({
    queryKey: ['payments-by-order', companyId],
    enabled: !!companyId && desktopView === 'list',
    queryFn: async () => {
      const { data } = await (supabase.from('payment_history') as any)
        .select('order_id, amount')
        .eq('company_id', companyId!)
      const map: Record<string, number> = {}
      ;(data ?? []).forEach((p: any) => {
        map[p.order_id] = (map[p.order_id] || 0) + Number(p.amount)
      })
      return map
    },
  })

  const { data: customers } = useQuery({
    queryKey: ['customers-select', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const response: any = await supabase
        .from('customers')
        .select('id, name, phone, email, cpf_cnpj, address, city, notes')
        .eq('company_id', companyId!)
        .order('name')
      return response?.data ?? []
    },
  })

  const { data: productsList } = useQuery({
    queryKey: ['products-picker', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('products') as any)
        .select('id, name, final_price, category, description, unit, width, height, area, measurement_unit, finishings, finishing_type, technical_notes')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name')
      return data ?? []
    },
  })

  /* Histórico de recebimentos do pedido em edição */
  const { data: paymentHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['payment_history', editingId],
    enabled: !!editingId && !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('payment_history') as any)
        .select('*')
        .eq('order_id', editingId!)
        .eq('company_id', companyId!)
        .order('payment_date', { ascending: true })
      return (data ?? []) as Array<{
        id: string
        amount: number
        payment_date: string
        payment_method: string | null
        observation: string | null
        percentage: number | null
        created_by: string | null
        created_at: string
        updated_at: string
      }>
    },
  })

  /* Auditoria do recebimento em visualização (Ver detalhes) */
  const { data: viewingPaymentAudit } = useQuery({
    queryKey: ['payment_history_audit', viewingPaymentId],
    enabled: !!viewingPaymentId,
    queryFn: async () => {
      const { data } = await (supabase.from('payment_history_audit') as any)
        .select('*')
        .eq('payment_history_id', viewingPaymentId!)
        .order('created_at', { ascending: false })
      return (data ?? []) as Array<{
        id: string
        action: 'create' | 'update' | 'delete'
        old_amount: number | null
        new_amount: number | null
        old_payment_method: string | null
        new_payment_method: string | null
        old_payment_date: string | null
        new_payment_date: string | null
        old_observation: string | null
        new_observation: string | null
        performed_by: string | null
        created_at: string
      }>
    },
  })

  /* Nomes de quem aparece no log de auditoria (pode incluir usuários não presentes no histórico atual) */
  const { data: auditUserNames } = useQuery({
    queryKey: ['audit-users', viewingPaymentId, (viewingPaymentAudit ?? []).map(a => a.performed_by).join(',')],
    enabled: !!viewingPaymentAudit && viewingPaymentAudit.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((viewingPaymentAudit ?? []).map(a => a.performed_by).filter(Boolean))) as string[]
      if (ids.length === 0) return {} as Record<string, string>
      const { data } = await (supabase.from('profiles') as any).select('id, name, email').in('id', ids)
      const map: Record<string, string> = {}
      ;(data ?? []).forEach((u: any) => { map[u.id] = u.name || u.email || 'Usuário' })
      return map
    },
  })

  /* Nomes de quem registrou cada recebimento */
  const { data: paymentUserNames } = useQuery({
    queryKey: ['payment-users', editingId, (paymentHistory ?? []).map(p => (p as any).created_by).join(',')],
    enabled: !!paymentHistory && paymentHistory.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((paymentHistory ?? []).map((p: any) => p.created_by).filter(Boolean)))
      if (ids.length === 0) return {} as Record<string, string>
      const { data } = await (supabase.from('profiles') as any).select('id, name, email').in('id', ids)
      const map: Record<string, string> = {}
      ;(data ?? []).forEach((u: any) => { map[u.id] = u.name || u.email || 'Usuário' })
      return map
    },
  })

  /* ─────────────────────────────────────────────
     FORMS
  ───────────────────────────────────────────── */

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      service_name: '',
      description: '',
      status: 'pending',
      subtotal: 0,
      discount: 0,
      delivery_fee: 0,
      additional_charges: 0,
      total: 0,
      notes: '',
      due_date: '',
      priority: 'normal',
      payment_method: '',
      product_id: '',
      order_date: '',
    },
  })

  const {
    register: registerPayment,
    handleSubmit: handleSubmitPayment,
    reset: resetPayment,
    watch: watchPayment,
    setValue: setPaymentValue,
    formState: { errors: paymentErrors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      fill_type: 'amount',
      amount: 0,
      percentage: 0,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      observation: '',
    },
  })

  const subtotal = watch('subtotal')
  const discount = watch('discount')
  const deliveryFee = watch('delivery_fee')
  const additionalCharges = watch('additional_charges')

  /* Subtotal é sempre a soma dos itens do carrinho */
  useEffect(() => {
    const itemsSubtotal = items.reduce((s, i) => s + i.subtotal, 0)
    setValue('subtotal', itemsSubtotal)
  }, [items, setValue])

  useEffect(() => {
    const t = Number(subtotal) - Number(discount) + Number(deliveryFee || 0) + Number(additionalCharges || 0)
    setValue('total', Math.max(0, t))
  }, [subtotal, discount, deliveryFee, additionalCharges, setValue])

  /* ─────────────────────────────────────────────
     SINCRONIA VALOR ⇄ PORCENTAGEM (modal de recebimento)
     Cálculo direto no onChange do campo ativo — sem efeitos encadeados.
  ───────────────────────────────────────────── */

  const paymentFillType = watchPayment('fill_type')

  function handleAmountInputChange(raw: string) {
    const cleaned = sanitizeDecimalTyping(raw)
    setAmountDisplayText(cleaned)
    const amt = parseDecimalPtBR(cleaned)
    setPaymentValue('amount', amt, { shouldValidate: true })
    const total = Number(watch('total')) || 0
    const pct = total > 0 ? (amt / total) * 100 : 0
    const pctRounded = Math.round(pct * 100) / 100
    setPaymentValue('percentage', pctRounded, { shouldValidate: false })
    setPercentageDisplayText(formatDecimalPtBR(pctRounded))
  }

  function handlePercentageInputChange(raw: string) {
    const cleaned = sanitizeDecimalTyping(raw)
    setPercentageDisplayText(cleaned)
    const pct = parseDecimalPtBR(cleaned)
    setPaymentValue('percentage', pct, { shouldValidate: true })
    const total = Number(watch('total')) || 0
    const amt = total > 0 ? (pct / 100) * total : 0
    const amtRounded = Math.round(amt * 100) / 100
    setPaymentValue('amount', amtRounded, { shouldValidate: false })
    setAmountDisplayText(formatDecimalPtBR(amtRounded))
  }

  /* ─────────────────────────────────────────────
     COMPUTED – resumo de pagamentos
  ───────────────────────────────────────────── */

  const orderTotal = Number(watch('total') || 0)
  const totalReceived = (paymentHistory ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const saldoRestante = Math.max(0, orderTotal - totalReceived)
  const pctRecebido = orderTotal > 0 ? Math.min(100, (totalReceived / orderTotal) * 100) : 0

  /* Ao editar um recebimento, o teto disponível inclui o próprio valor atual dele */
  const editingPaymentAmount = editingPaymentId
    ? Number((paymentHistory ?? []).find(p => p.id === editingPaymentId)?.amount ?? 0)
    : 0
  const modalMaxAmount = saldoRestante + editingPaymentAmount

  /* ─────────────────────────────────────────────
     CLIENTE — cadastrado x novo
  ───────────────────────────────────────────── */

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustomer.name.trim()) throw new Error('Informe o nome do cliente')
      const { data, error } = await (supabase.from('customers') as any)
        .insert([{
          company_id: companyId!,
          name: newCustomer.name.trim(),
          phone: newCustomer.phone || null,
          email: newCustomer.email || null,
          cpf_cnpj: newCustomer.cpf_cnpj || null,
          address: newCustomer.address || null,
          city: newCustomer.city || null,
          notes: newCustomer.notes || null,
          total_purchases: 0,
        }])
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return data.id as string
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['customers-select', companyId] })
      setValue('customer_id', newId, { shouldValidate: true })
      setCustomerMode('existing')
      setCustomerSearch(newCustomer.name)
      setNewCustomer({ name: '', phone: '', email: '', cpf_cnpj: '', address: '', city: '', notes: '' })
      toast('success', 'Cliente cadastrado e selecionado!')
    },
    onError: (err: Error) => {
      toast('error', `Erro ao cadastrar cliente: ${err.message}`)
    },
  })

  const selectedCustomer = (customers ?? []).find((c: any) => c.id === watch('customer_id'))

  /* ─────────────────────────────────────────────
     ITENS DO PEDIDO — carrinho
  ───────────────────────────────────────────── */

  function addItemFromProduct(p: any) {
    const unitPrice = Number(p.final_price) || 0
    const item: OrderItem = {
      id: uid(),
      product_id: p.id,
      name: p.name,
      description: p.description || '',
      quantity: 1,
      unit_price: unitPrice,
      discount: 0,
      discount_type: 'amount',
      subtotal: unitPrice,
      width: p.width ?? undefined,
      height: p.height ?? undefined,
      area: p.area ?? undefined,
      measurement_unit: p.measurement_unit ?? undefined,
      finishings: Array.isArray(p.finishings) ? p.finishings : [],
      finishing_type: p.finishing_type ?? undefined,
      technical_notes: p.technical_notes ?? undefined,
    }
    setItems(prev => [...prev, item])
    setShowProductPicker(false)
    setProductSearch('')
  }

  function addManualItem() {
    setShowItemTechDetails(false)
    setEditingItem({
      id: uid(),
      name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      discount: 0,
      discount_type: 'amount',
      subtotal: 0,
      finishings: [],
    })
    setShowProductPicker(false)
  }

  function openEditItem(item: OrderItem) {
    setShowItemTechDetails(false)
    setEditingItem({ ...item })
  }

  function saveEditItem(item: OrderItem) {
    const updated = { ...item, subtotal: computeItemSubtotal(item) }
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
      return [...prev, updated]
    })
    setEditingItem(null)
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  /* ─────────────────────────────────────────────
     SAVE ORDER
  ───────────────────────────────────────────── */

  function buildOrderPayload(data: FormData) {
    const firstItem = items[0]
    const serviceName = firstItem
      ? `${firstItem.name}${items.length > 1 ? ` +${items.length - 1} ${items.length === 2 ? 'item' : 'itens'}` : ''}`
      : (data.service_name || '')
    return {
      customer_id: data.customer_id,
      service_name: serviceName,
      description: data.description || firstItem?.description || null,
      status: data.status || 'pending',
      payment_method: data.payment_method || null,
      subtotal: Number(data.subtotal) || 0,
      discount: Number(data.discount) || 0,
      delivery_fee: Number(data.delivery_fee) || 0,
      additional_charges: Number(data.additional_charges) || 0,
      total: Number(data.total) || 0,
      notes: data.notes || null,
      due_date: data.due_date || null,
      priority: data.priority || 'normal',
      product_id: firstItem?.product_id || null,
    }
  }

  /** Grava (delete + insert) as linhas de order_items a partir do carrinho atual. */
  async function persistOrderItems(orderId: string) {
    await (supabase.from('order_items') as any).delete().eq('order_id', orderId)
    if (items.length === 0) return
    const rows = items.map(i => ({
      order_id: orderId,
      product_id: i.product_id || null,
      name: i.name,
      description: i.description || null,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount,
      discount_type: i.discount_type,
      subtotal: i.subtotal,
      width: i.width ?? null,
      height: i.height ?? null,
      area: i.area ?? null,
      measurement_unit: i.measurement_unit ?? null,
      finishings: i.finishings ?? [],
      finishing_type: i.finishing_type ?? null,
      technical_notes: i.technical_notes ?? null,
    }))
    const { error } = await (supabase.from('order_items') as any).insert(rows)
    if (error) throw new Error(`Erro ao salvar itens do pedido: ${error.message}`)
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (items.length === 0) throw new Error('Adicione ao menos um produto ao pedido.')

      const wasCreate = !editingId
      const payload = buildOrderPayload(data)

      if (!editingId && companyId && sub && !sub.isPro) {
        const limit = sub.limits.orders
        if (Number.isFinite(limit)) {
          const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
          const { count } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .gte('created_at', startOfMonth.toISOString())
          if ((count ?? 0) >= limit) {
            throw new Error(`Limite de ${limit} pedidos/mês do plano Basic atingido. Faça upgrade para o PRO e crie pedidos ilimitados.`)
          }
        }
      }

      let orderId = editingId
      if (editingId) {
        const { error } = await (supabase.from('orders') as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw new Error(error.message)

        // O total pode ter mudado (item removido/adicionado, desconto editado)
        // — sem recalcular aqui, payment_status ficava desatualizado até o
        // próximo recebimento ser registrado/editado/excluído.
        const currentOrder = (orders ?? []).find((o: any) => o.id === editingId)
        await recalcOrderPaymentStatus(supabase, editingId, companyId!, payload.total, currentOrder?.paid_at ?? null)
      } else {
        const { data: created, error } = await (supabase.from('orders') as any)
          .insert([{ ...payload, company_id: companyId!, order_number: '' }])
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        orderId = created.id
      }

      await persistOrderItems(orderId!)

      return { orderId: orderId as string, wasCreate }
    },

    onSuccess: ({ orderId, wasCreate }) => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })

      if (wasCreate) {
        // Fluxo contínuo: após criar, mantém o modal aberto já em modo de
        // edição do pedido recém-criado (sem fechar/reabrir e sem 2ª criação).
        toast('success', 'Pedido criado com sucesso.')
        setEditingId(orderId)
        setEditingPaymentId(null)
      } else {
        setShowModal(false)
        reset()
        setEditingId(null)
        setEditingPaymentId(null)
        setItems([])
        setCustomerMode('existing')
        setCustomerSearch('')
        toast('success', 'Pedido atualizado!')
      }
    },

    onError: (err: Error) => {
      toast('error', `Erro: ${err.message}`)
    },
  })

  /* ─────────────────────────────────────────────
     REGISTRAR RECEBIMENTO
  ───────────────────────────────────────────── */

  const registerPaymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentFormData) => {
      if (!editingId || !companyId) throw new Error('Pedido não encontrado')

      const orderRecord = (orders ?? []).find((o: any) => o.id === editingId) as any
      if (!orderRecord) throw new Error('Pedido não encontrado')

      const amount = Number(paymentData.amount)
      const orderTotalValue = Number(orderRecord.total)

      /* Buscar histórico atual para calcular total já recebido */
      const { data: existingHistory } = await (supabase.from('payment_history') as any)
        .select('amount')
        .eq('order_id', editingId)
        .eq('company_id', companyId)
      const alreadyReceived = (existingHistory ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)
      const newTotal = alreadyReceived + amount

      if (newTotal > orderTotalValue) {
        const msg = paymentData.fill_type === 'percentage'
          ? 'O percentual ultrapassa o saldo restante.'
          : 'O valor informado é maior que o saldo restante.'
        throw new Error(`${msg} Máximo permitido: ${fmtGlobal(orderTotalValue - alreadyReceived)}`)
      }

      const percentage = orderTotalValue > 0 ? (amount / orderTotalValue) * 100 : 0

      /* Registra recebimento + lançamento financeiro atomicamente (RPC
         register_order_payment) — se um dos dois inserts falhar, o Postgres
         desfaz os dois, evitando dessincronia entre os módulos. */
      const { error: rpcError } = await (supabase.rpc as any)('register_order_payment', {
        p_order_id: editingId,
        p_company_id: companyId,
        p_customer_id: orderRecord.customer_id,
        p_amount: amount,
        p_payment_date: paymentData.payment_date,
        p_payment_method: paymentData.payment_method || null,
        p_observation: paymentData.observation || null,
        p_percentage: percentage,
        p_order_number: orderRecord.order_number || '',
        p_service_name: orderRecord.service_name || 'Serviço',
        p_client_name: orderRecord.customers?.name || null,
        p_created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      if (rpcError) throw new Error(`Erro ao registrar recebimento: ${rpcError.message}`)

      /* 3. Recalcular payment_status/paid_at a partir do SUM do payment_history */
      const newPaymentStatus = await recalcOrderPaymentStatus(supabase, editingId, companyId, orderTotalValue, orderRecord.paid_at ?? null)

      /* 4. Atualizar total_purchases do cliente */
      if (orderRecord.customer_id) {
        await recalcCustomerTotalPurchases(supabase, orderRecord.customer_id, companyId)
      }

      return newPaymentStatus
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_history', editingId] })
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] })
      setShowPaymentModal(false)
      setEditingPaymentId(null)
      resetPayment()
      setAmountDisplayText('')
      setPercentageDisplayText('')
      toast('success', 'Recebimento registrado!')
    },

    onError: (err: Error) => {
      toast('error', `Erro: ${err.message}`)
    },
  })

  /* ─────────────────────────────────────────────
     EDITAR RECEBIMENTO
  ───────────────────────────────────────────── */

  const updatePaymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentFormData) => {
      if (!editingId || !companyId || !editingPaymentId) throw new Error('Recebimento não encontrado')

      const orderRecord = (orders ?? []).find((o: any) => o.id === editingId) as any
      if (!orderRecord) throw new Error('Pedido não encontrado')

      const amount = Number(paymentData.amount)
      const orderTotalValue = Number(orderRecord.total)

      /* Saldo já recebido, excluindo o próprio pagamento em edição */
      const { data: existingHistory } = await (supabase.from('payment_history') as any)
        .select('id, amount')
        .eq('order_id', editingId)
        .eq('company_id', companyId)
      const alreadyReceived = (existingHistory ?? [])
        .filter((p: any) => p.id !== editingPaymentId)
        .reduce((s: number, p: any) => s + Number(p.amount), 0)
      const newTotal = alreadyReceived + amount

      if (newTotal > orderTotalValue) {
        const msg = paymentData.fill_type === 'percentage'
          ? 'O percentual ultrapassa o saldo restante.'
          : 'O valor informado é maior que o saldo restante.'
        throw new Error(`${msg} Máximo permitido: ${fmtGlobal(orderTotalValue - alreadyReceived)}`)
      }

      const percentage = orderTotalValue > 0 ? (amount / orderTotalValue) * 100 : 0

      /* Atualiza recebimento + lançamento financeiro atomicamente (RPC
         update_order_payment). */
      const { error: rpcError } = await (supabase.rpc as any)('update_order_payment', {
        p_payment_id: editingPaymentId,
        p_amount: amount,
        p_payment_date: paymentData.payment_date,
        p_payment_method: paymentData.payment_method || null,
        p_observation: paymentData.observation || null,
        p_percentage: percentage,
        p_description: `Recebimento — Pedido ${orderRecord.order_number || ''} · ${orderRecord.service_name || 'Serviço'}${paymentData.observation ? ' · ' + paymentData.observation : ''}`,
      })
      if (rpcError) throw new Error(`Erro ao editar recebimento: ${rpcError.message}`)

      /* 3. Recalcular payment_status/paid_at e total_purchases */
      await recalcOrderPaymentStatus(supabase, editingId, companyId, orderTotalValue, orderRecord.paid_at ?? null)
      if (orderRecord.customer_id) {
        await recalcCustomerTotalPurchases(supabase, orderRecord.customer_id, companyId)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_history', editingId] })
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] })
      setShowPaymentModal(false)
      setEditingPaymentId(null)
      resetPayment()
      setAmountDisplayText('')
      setPercentageDisplayText('')
      toast('success', 'Recebimento atualizado!')
    },

    onError: (err: Error) => {
      toast('error', `Erro: ${err.message}`)
    },
  })

  /* ─────────────────────────────────────────────
     EXCLUIR RECEBIMENTO
  ───────────────────────────────────────────── */

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      if (!editingId || !companyId) throw new Error('Pedido não encontrado')

      const orderRecord = (orders ?? []).find((o: any) => o.id === editingId) as any
      if (!orderRecord) throw new Error('Pedido não encontrado')

      /* Remove lançamento financeiro + recebimento atomicamente (RPC
         delete_order_payment). */
      const { error: rpcError } = await (supabase.rpc as any)('delete_order_payment', {
        p_payment_id: paymentId,
      })
      if (rpcError) throw new Error(`Erro ao excluir recebimento: ${rpcError.message}`)

      /* 3. Recalcular payment_status/paid_at e total_purchases */
      await recalcOrderPaymentStatus(supabase, editingId, companyId, Number(orderRecord.total), orderRecord.paid_at ?? null)
      if (orderRecord.customer_id) {
        await recalcCustomerTotalPurchases(supabase, orderRecord.customer_id, companyId)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_history', editingId] })
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] })
      toast('success', 'Recebimento excluído!')
    },

    onError: (err: Error) => {
      toast('error', `Erro: ${err.message}`)
    },
  })

  /* ─────────────────────────────────────────────
     UPDATE STATUS
  ───────────────────────────────────────────── */

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from('orders') as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      toast('success', 'Status atualizado!')
    },

    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      toast('error', `Erro ao mover pedido: ${err.message}`)
    },
  })

  /* ─────────────────────────────────────────────
     DELETE
  ───────────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[pedidos] excluir pedido:', id)

      // Eventos da agenda vinculados não têm FK CASCADE (só SET NULL) —
      // apaga explicitamente em vez de deixar "entrega" órfã na agenda.
      await (supabase.from('calendar_tasks') as any).delete().eq('linked_order_id', id)

      const { data, error } = await (supabase.from('orders') as any)
        .delete()
        .eq('id', id)
        .select()

      console.log('[pedidos] resposta do Supabase (delete):', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        // delete sem erro mas 0 linhas afetadas: id inexistente ou RLS
        // bloqueou silenciosamente — sem essa checagem parecia sucesso
        // sem excluir nada.
        throw new Error('Nenhum pedido foi excluído — verifique se ele ainda existe ou se você tem permissão.')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-orders'] })
      toast('success', 'Pedido excluído com sucesso.')
      setConfirmDeleteOrderId(null)
      setShowModal(false)
      resetOrderForm()
    },
    onError: (err: Error) => {
      console.error('[pedidos] erro ao excluir pedido:', err)
      toast('error', `Erro ao excluir pedido: ${err.message}`)
      setConfirmDeleteOrderId(null)
    },
  })

  /* ─────────────────────────────────────────────
     OPEN ORDER
  ───────────────────────────────────────────── */

  function resetOrderForm() {
    reset()
    setEditingId(null)
    setEditingPaymentId(null)
    setItems([])
    setCustomerMode('existing')
    setCustomerSearch('')
    setShowCustomerPicker(false)
    setNewCustomer({ name: '', phone: '', email: '', cpf_cnpj: '', address: '', city: '', notes: '' })
    setShowProductPicker(false)
    setEditingItem(null)
  }

  async function openOrder(order: Record<string, unknown>) {
    setEditingId(order.id as string)
    setEditingPaymentId(null)
    setCustomerMode('existing')
    setNewCustomer({ name: '', phone: '', email: '', cpf_cnpj: '', address: '', city: '', notes: '' })
    const fields = [
      'customer_id', 'service_name', 'description', 'status',
      'subtotal', 'discount', 'delivery_fee', 'additional_charges', 'total', 'notes',
      'due_date', 'priority', 'payment_method',
      'product_id', 'order_date',
    ]
    fields.forEach(k => {
      const val = order[k]
      if (val !== undefined && val !== null) setValue(k as never, val as never)
    })

    const { data: rows } = await (supabase.from('order_items') as any)
      .select('*')
      .eq('order_id', order.id as string)

    if (rows && rows.length > 0) {
      setItems(rows.map((i: any) => ({
        id: i.id || uid(),
        product_id: i.product_id || undefined,
        name: i.name || 'Item',
        description: i.description || '',
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.unit_price) || 0,
        discount: Number(i.discount) || 0,
        discount_type: (i.discount_type as 'amount' | 'percentage') ?? 'amount',
        subtotal: Number(i.subtotal) || 0,
        width: i.width ?? undefined,
        height: i.height ?? undefined,
        area: i.area ?? undefined,
        measurement_unit: i.measurement_unit ?? 'm',
        finishings: Array.isArray(i.finishings) ? i.finishings : [],
        finishing_type: i.finishing_type ?? undefined,
        technical_notes: i.technical_notes ?? undefined,
      })))
    } else {
      /* Pedido legado (anterior ao carrinho) — sintetiza 1 item a partir dos campos antigos */
      const total = Number(order.total) || 0
      const serviceName = String(order.service_name || '').trim()
      setItems(total > 0 || serviceName ? [{
        id: uid(),
        product_id: (order.product_id as string) || undefined,
        name: serviceName || 'Item',
        description: String(order.description || ''),
        quantity: 1,
        unit_price: total,
        discount: 0,
        discount_type: 'amount',
        subtotal: total,
      }] : [])
    }

    setShowModal(true)
  }

  async function handleGeneratePDF(order: Record<string, unknown>) {
    const orderId = order.id as string
    setGeneratingPdfId(orderId)
    try {
      const { generateOrderPDF } = await import('@/lib/pdf/generateOrderPDF')

      const { data: fullOrder } = await (supabase.from('orders') as any)
        .select('*, customers(id, name, email, phone, city, state, cpf_cnpj, address)')
        .eq('id', orderId)
        .single()

      const { data: itemRows } = await (supabase.from('order_items') as any)
        .select('*, products(name, description, width, height, area, measurement_unit, finishings, finishing_type, technical_notes)')
        .eq('order_id', orderId)

      const { data: payments } = await (supabase.from('payment_history') as any)
        .select('*')
        .eq('order_id', orderId)
        .order('payment_date', { ascending: true })

      await generateOrderPDF({
        order: fullOrder ?? order,
        items: itemRows ?? [],
        payments: payments ?? [],
        company: companyData,
      })
    } catch (err) {
      console.error('[pdf]', err)
      toast('error', 'Erro ao gerar PDF.')
    } finally {
      setGeneratingPdfId(null)
    }
  }

  function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault()
    if (dragging) {
      updateStatus.mutate({ id: dragging, status: newStatus })
      setDragging(null)
    }
  }

  /* ─────────────────────────────────────────────
     FILTER
  ───────────────────────────────────────────── */

  const filtered = orders?.filter((o: any) => {
    const customerName = (o.customers as any)?.name?.toString()?.toLowerCase() ?? ''
    const serviceName = o.service_name?.toLowerCase?.() ?? ''
    return (
      customerName.includes(search.toLowerCase()) ||
      serviceName.includes(search.toLowerCase())
    )
  }) ?? []

  /* ─────────────────────────────────────────────
     VISÃO EM LISTA — helpers, ordenação e paginação
  ───────────────────────────────────────────── */

  const PRODUCTION_LABEL: Record<string, string> = {
    pending: 'Pendente', production: 'Produção', ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado',
  }
  const PRODUCTION_BADGE: Record<string, string> = {
    pending: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
    production: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ready: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    delivered: 'bg-primary-50 text-primary dark:bg-primary/10',
    cancelled: 'bg-error-light text-error',
  }
  const PRIORITY_LABEL: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }
  const PRIORITY_BADGE: Record<string, string> = {
    low: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
    normal: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
    high: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    urgent: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }

  function getFinancialBadge(order: any): { label: string; cls: string } {
    if (order.payment_status === 'paid') {
      return { label: 'Pago', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
    }
    const isOverdue = order.due_date
      && new Date(order.due_date) < new Date(new Date().toDateString())
      && order.status !== 'delivered' && order.status !== 'cancelled'
    if (isOverdue) {
      return { label: 'Atrasado', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' }
    }
    if (order.payment_status === 'partial') {
      return { label: 'Parcial', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
    }
    return { label: 'Pendente', cls: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400' }
  }

  function getOrigin(order: any): string {
    if (order.source === 'catalog') return 'Catálogo Online'
    if (order.quote_id) return 'Orçamento'
    return 'Manual'
  }

  const listRows = filtered.map((o: any) => {
    const total = Number(o.total) || 0
    const received = paymentsByOrder?.[o.id] ?? 0
    return {
      ...o,
      _received: received,
      _saldo: Math.max(0, total - received),
      _financial: getFinancialBadge(o),
      _origin: getOrigin(o),
    }
  })

  function getListSortValue(o: any, key: string): string | number {
    switch (key) {
      case 'order_number':    return o.order_number || ''
      case 'customer':        return o.customers?.name || ''
      case 'service_name':    return o.service_name || ''
      case 'total':           return Number(o.total) || 0
      case 'received':        return o._received || 0
      case 'saldo':           return o._saldo || 0
      case 'status':          return o.status || ''
      case 'priority':        return ({ low: 0, normal: 1, high: 2, urgent: 3 } as any)[o.priority] ?? 1
      case 'order_date':      return o.order_date || o.created_at || ''
      case 'due_date':        return o.due_date || ''
      case 'payment_method':  return o.payment_method || ''
      case 'created_at':      return o.created_at || ''
      default:                return ''
    }
  }

  const filteredListRows = listStatusFilter === 'all'
    ? listRows
    : listRows.filter((o: any) => o.status === listStatusFilter)

  const sortedListRows = [...filteredListRows].sort((a, b) => {
    const dir = listSort.dir === 'asc' ? 1 : -1
    const av = getListSortValue(a, listSort.key)
    const bv = getListSortValue(b, listSort.key)
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  const listTotalPages = Math.max(1, Math.ceil(sortedListRows.length / LIST_PAGE_SIZE))
  const pagedListRows = sortedListRows.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE)

  useEffect(() => {
    setListPage(1)
  }, [search, listStatusFilter, desktopView])

  function ListSortHeader({ sortKey, children }: { sortKey: string; children: React.ReactNode }) {
    const active = listSort.key === sortKey
    return (
      <th
        onClick={() => toggleListSort(sortKey)}
        className="text-left font-semibold px-3 py-2.5 cursor-pointer select-none hover:text-primary transition-colors whitespace-nowrap"
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {active && (listSort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
        </span>
      </th>
    )
  }

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */

  return (
    <div className="page-enter">

      <Header title="Pedidos" subtitle="Acompanhamento de produção" />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar pedidos..."
                className="input pl-9 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Seletor de visualização — Desktop (Kanban x Lista) */}
            <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl p-1 shadow-card flex-shrink-0">
              <button
                type="button"
                onClick={() => handleSetDesktopView('kanban')}
                title="Visualizar em Kanban"
                className={clsx(
                  'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200',
                  desktopView === 'kanban'
                    ? 'bg-primary text-white shadow-btn'
                    : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5'
                )}
              >
                <LayoutGrid size={14} /> Kanban
              </button>
              <button
                type="button"
                onClick={() => handleSetDesktopView('list')}
                title="Visualizar em Lista"
                className={clsx(
                  'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200',
                  desktopView === 'list'
                    ? 'bg-primary text-white shadow-btn'
                    : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5'
                )}
              >
                <LayoutList size={14} /> Lista
              </button>
            </div>
          </div>

          <button
            onClick={() => { resetOrderForm(); setShowModal(true) }}
            className="btn-primary flex items-center gap-2 flex-shrink-0"
          >
            <Plus size={16} />
            Novo Pedido
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="card"><SkeletonTable /></div>
        ) : orders?.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido"
            description="Crie seu primeiro pedido."
            action={{ label: '+ Novo Pedido', onClick: () => { resetOrderForm(); setShowModal(true) } }}
          />
        ) : (
          <>
            {/* ── MOBILE: seletor de visualização ── */}
            <div className="sm:hidden flex items-center gap-1 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl p-1 mb-3 shadow-card">
              <button
                onClick={() => handleSetMobileView('list')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all duration-200',
                  mobileView === 'list'
                    ? 'bg-primary text-white shadow-btn'
                    : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5'
                )}
              >
                <LayoutList size={14} /> Lista
              </button>
              <button
                onClick={() => handleSetMobileView('kanban')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all duration-200',
                  mobileView === 'kanban'
                    ? 'bg-primary text-white shadow-btn'
                    : 'text-text-secondary dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-white/5'
                )}
              >
                <LayoutGrid size={14} /> Kanban
              </button>
            </div>

            {/* ── MOBILE: Lista ── */}
            <div className={clsx('sm:hidden space-y-2', mobileView !== 'list' && 'hidden')}>
              {filtered.map((order: any) => (
                <div key={order.id} className="card p-0 overflow-hidden" onClick={() => openOrder(order)}>
                  <div className="flex items-start gap-3 p-3.5">
                    <div className={clsx(
                      'w-2 self-stretch rounded-full flex-shrink-0',
                      order.status === 'production' ? 'bg-blue-400'
                        : order.status === 'ready'     ? 'bg-green-400'
                        : order.status === 'delivered' ? 'bg-primary'
                        : 'bg-stone-300 dark:bg-stone-600'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">
                            {order.service_name || '—'}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {order.customers?.name || 'Sem cliente'} · {order.order_number || ''}
                          </p>
                          {(order as any).quote_id && (
                            <a href="/orcamentos" className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-primary hover:opacity-80">
                              <FileText size={9} /> Do orçamento
                            </a>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-primary">{formatCurrency(Number(order.total))}</p>
                          <span className={clsx(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            order.payment_status === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : order.payment_status === 'partial'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                          )}>
                            {order.payment_status === 'paid' ? 'Pago'
                              : order.payment_status === 'partial' ? 'Parcial'
                              : 'Pendente'}
                          </span>
                        </div>
                      </div>
                      {order.due_date && (
                        <div className="flex items-center gap-1 mt-2 text-[11px] text-text-muted">
                          <CalendarDays size={11} />
                          {format(new Date(order.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0 self-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); openOrder(order) }}
                        className="p-1.5 rounded-xl text-text-muted hover:text-primary hover:bg-primary-50"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteOrderId(order.id) }}
                        className="p-1.5 rounded-xl text-text-muted hover:text-error hover:bg-error-light"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── MOBILE: Kanban ── */}
            <div className={clsx('sm:hidden -mx-3 px-3', mobileView !== 'kanban' && 'hidden')}>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                {STATUS_COLUMNS_MOBILE.map(col => {
                  const colOrders = filtered.filter((o: any) => o.status === col.id)
                  return (
                    <div
                      key={col.id}
                      data-status-col={col.id}
                      className={clsx('relative flex-shrink-0 w-[78vw] max-w-[300px] snap-start rounded-2xl border-2 p-2.5', col.color)}
                    >
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-xs font-bold text-text-primary dark:text-stone-100">{col.label}</p>
                        <span className="text-[10px] font-semibold text-text-muted bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded-full">
                          {colOrders.length}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                        {colOrders.length === 0 ? (
                          <p className="text-[10px] text-text-muted text-center py-4">Nenhum pedido</p>
                        ) : (
                          colOrders.map((order: any) => (
                            <div
                              key={order.id}
                              data-order-id={order.id}
                              onClick={() => openOrder(order)}
                              onTouchStart={() => setMobileDragging(order.id)}
                              onTouchMove={(e) => e.preventDefault()}
                              onTouchEnd={(e) => {
                                if (!mobileDragging) return
                                const touch = e.changedTouches[0]
                                const el = document.elementFromPoint(touch.clientX, touch.clientY)
                                const targetCol = el?.closest('[data-status-col]') as HTMLElement | null
                                const newStatus = targetCol?.dataset.statusCol
                                if (newStatus && newStatus !== order.status) {
                                  updateStatus.mutate({ id: mobileDragging, status: newStatus })
                                }
                                setMobileDragging(null)
                              }}
                              className={clsx(
                                'bg-white dark:bg-surface-dark rounded-xl p-3 shadow-sm border border-border dark:border-border-dark cursor-pointer active:scale-[0.98] transition-transform',
                                mobileDragging === order.id && 'opacity-50 scale-95'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="flex items-center gap-1">
                                  <span className="text-[10px] font-mono text-text-muted">{order.order_number || '—'}</span>
                                  {order.source === 'catalog' && (
                                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-primary/10 text-primary">Online</span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteOrderId(order.id) }}
                                    className="p-0.5 rounded text-text-muted/60 hover:text-error"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                  <GripVertical size={11} className="text-text-muted/50" />
                                </div>
                              </div>
                              <p className="text-xs font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">
                                {order.service_name || '—'}
                              </p>
                              <p className="text-[11px] text-text-muted mt-0.5 truncate">
                                {order.customers?.name || 'Sem cliente'}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs font-bold text-primary">{formatCurrency(Number(order.total))}</span>
                                <span className={clsx(
                                  'text-[9px] font-medium px-1.5 py-0.5 rounded-full',
                                  order.payment_status === 'paid'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : order.payment_status === 'partial'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                      : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                                )}>
                                  {order.payment_status === 'paid' ? 'Pago'
                                    : order.payment_status === 'partial' ? 'Parcial'
                                    : 'Pendente'}
                                </span>
                              </div>
                              {order.due_date && (
                                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-text-muted">
                                  <CalendarDays size={10} />
                                  {format(new Date(order.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-text-muted text-center mt-2 flex items-center justify-center gap-1">
                <GripVertical size={10} /> Toque e arraste o card para mudar o status
              </p>
            </div>

            {/* ── DESKTOP: Kanban ── */}
            <div className={clsx('hidden sm:grid grid-cols-2 xl:grid-cols-4 gap-3', desktopView === 'list' && 'sm:hidden')}>
              {STATUS_COLUMNS.map((col) => {
                const colOrders = filtered.filter((o: any) => o.status === col.id)
                return (
                  <div
                    key={col.id}
                    className={clsx('rounded-2xl border p-3 min-h-[300px]', col.color)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">{col.label}</h3>
                      <span className="badge badge-primary">{colOrders.length}</span>
                    </div>

                    <div className="space-y-3">
                      {colOrders.map((order: any) => (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={() => setDragging(order.id)}
                          className={clsx(
                            'group bg-white dark:bg-surface-dark rounded-2xl p-3.5 shadow-card border transition-all cursor-grab active:cursor-grabbing',
                            dragging === order.id
                              ? 'border-primary/40 shadow-[0_0_0_2px_rgba(139,108,79,0.15)] scale-[0.98] opacity-70'
                              : 'border-border dark:border-border-dark hover:border-primary/30 hover:shadow-md'
                          )}
                        >
                          {/* Row 1: number + actions */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <GripVertical size={12} className="text-text-muted/50 flex-shrink-0" />
                              <span className="text-[10px] font-mono text-text-muted">{order.order_number || '—'}</span>
                              {order.source === 'catalog' && (
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-primary/10 text-primary">Online</span>
                              )}
                              {(order as any).quote_id && (
                                <a href="/orcamentos" className="inline-flex items-center gap-0.5 text-[9px] font-medium text-primary hover:opacity-80" title="Originado de orçamento">
                                  <FileText size={9} /> ORC
                                </a>
                              )}
                              {(order as any).priority === 'urgent' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">URGENTE</span>
                              )}
                              {(order as any).priority === 'high' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">ALTA</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGeneratePDF(order) }}
                                disabled={generatingPdfId === order.id}
                                className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"
                                title="Gerar PDF"
                              >
                                {generatingPdfId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openOrder(order) }}
                                className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors"
                                title="Editar pedido"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteOrderId(order.id) }}
                                className="p-1 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: service name */}
                          <p className="font-semibold text-sm text-text-primary dark:text-stone-100 leading-snug break-words">
                            {(order as any).service_name || '—'}
                          </p>

                          {/* Row 3: client */}
                          <div className="flex items-center gap-1 mt-1">
                            <User size={10} className="text-text-muted flex-shrink-0" />
                            <p className="text-[11px] text-text-muted break-words">
                              {(order.customers as any)?.name || 'Sem cliente'}
                            </p>
                          </div>

                          {/* Row 4: value + payment badge */}
                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50 dark:border-border-dark/50">
                            <span className="font-bold text-sm text-primary">
                              {formatCurrency(Number(order.total))}
                            </span>
                            <span className={clsx(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                              (order as any).payment_status === 'paid'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : (order as any).payment_status === 'partial'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                            )}>
                              {(order as any).payment_status === 'paid' ? 'Pago'
                                : (order as any).payment_status === 'partial' ? 'Parcial'
                                : 'Pendente'}
                            </span>
                          </div>

                          {/* Row 5: due date + method */}
                          <div className="flex items-center justify-between mt-1.5">
                            {(order as any).due_date ? (
                              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                                <CalendarDays size={10} />
                                {format(new Date((order as any).due_date), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                            ) : <span />}
                            {(order as any).payment_method && (
                              <span className="text-[10px] text-text-muted/70 uppercase tracking-wide">
                                {formatMethod((order as any).payment_method)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── DESKTOP: Lista ── */}
            {desktopView === 'list' && (
              <div className="hidden sm:block space-y-3">
                {/* Filtros rápidos por status de produção */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[{ id: 'all', label: 'Todos' }, ...STATUS_COLUMNS_MOBILE.map(c => ({ id: c.id, label: c.label }))].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setListStatusFilter(f.id)}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        listStatusFilter === f.id
                          ? 'bg-primary text-white border-primary'
                          : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/40'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-border dark:border-border-dark overflow-x-auto bg-white dark:bg-surface-dark shadow-card">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-stone-50 dark:bg-stone-800/50 text-[10px] uppercase tracking-wide text-text-muted border-b border-border dark:border-border-dark">
                        <ListSortHeader sortKey="order_number">Nº Pedido</ListSortHeader>
                        <ListSortHeader sortKey="customer">Cliente</ListSortHeader>
                        <ListSortHeader sortKey="service_name">Produtos</ListSortHeader>
                        <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleListSort('total')}>
                          <span className="inline-flex items-center gap-1 justify-end w-full">
                            Valor Total
                            {listSort.key === 'total' && (listSort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                          </span>
                        </th>
                        <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleListSort('received')}>
                          <span className="inline-flex items-center gap-1 justify-end w-full">
                            Recebido
                            {listSort.key === 'received' && (listSort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                          </span>
                        </th>
                        <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleListSort('saldo')}>
                          <span className="inline-flex items-center gap-1 justify-end w-full">
                            Saldo
                            {listSort.key === 'saldo' && (listSort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                          </span>
                        </th>
                        <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Status Financeiro</th>
                        <ListSortHeader sortKey="status">Status Produção</ListSortHeader>
                        <ListSortHeader sortKey="priority">Prioridade</ListSortHeader>
                        <ListSortHeader sortKey="order_date">Data do Pedido</ListSortHeader>
                        <ListSortHeader sortKey="due_date">Prazo de Entrega</ListSortHeader>
                        <ListSortHeader sortKey="payment_method">Forma de Pagamento</ListSortHeader>
                        <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Origem</th>
                        <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Responsável</th>
                        <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedListRows.length === 0 ? (
                        <tr>
                          <td colSpan={15} className="text-center py-8 text-text-muted">
                            Nenhum pedido encontrado.
                          </td>
                        </tr>
                      ) : pagedListRows.map((order: any, idx: number) => (
                        <tr
                          key={order.id}
                          onClick={() => openOrder(order)}
                          className={clsx(
                            'cursor-pointer hover:bg-primary-50 dark:hover:bg-white/5 transition-colors',
                            idx !== 0 && 'border-t border-border dark:border-border-dark'
                          )}
                        >
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono text-text-muted">{order.order_number || '—'}</td>
                          <td className="px-3 py-2.5 max-w-[160px] truncate font-medium text-text-primary dark:text-stone-100" title={order.customers?.name || ''}>
                            {order.customers?.name || 'Sem cliente'}
                          </td>
                          <td className="px-3 py-2.5 max-w-[180px] truncate text-text-muted" title={order.service_name || ''}>
                            {order.service_name || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap font-bold text-primary">{formatCurrency(Number(order.total))}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold text-green-700 dark:text-green-400">{formatCurrency(order._received)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(order._saldo)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', order._financial.cls)}>
                              {order._financial.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', PRODUCTION_BADGE[order.status] ?? PRODUCTION_BADGE.pending)}>
                              {PRODUCTION_LABEL[order.status] ?? order.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', PRIORITY_BADGE[order.priority] ?? PRIORITY_BADGE.normal)}>
                              {PRIORITY_LABEL[order.priority] ?? 'Normal'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                            {order.order_date || order.created_at ? format(parseISO(order.order_date || order.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                            {order.due_date ? format(parseISO(order.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                            {order.payment_method ? formatMethod(order.payment_method) : '—'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">{order._origin}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-text-muted/60">—</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGeneratePDF(order) }}
                                disabled={generatingPdfId === order.id}
                                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
                                title="Gerar PDF"
                              >
                                {generatingPdfId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openOrder(order) }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
                                title="Editar pedido"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteOrderId(order.id) }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-text-muted">{sortedListRows.length} pedido{sortedListRows.length === 1 ? '' : 's'}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={listPage <= 1}
                      onClick={() => setListPage(p => Math.max(1, p - 1))}
                      className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="text-xs text-text-muted">Página {listPage} de {listTotalPages}</span>
                    <button
                      type="button"
                      disabled={listPage >= listTotalPages}
                      onClick={() => setListPage(p => Math.min(listTotalPages, p + 1))}
                      className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════
          MODAL NOVO / EDITAR PEDIDO
      ══════════════════════════════════ */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowModal(false); setShowProductPicker(false) }}
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-2xl max-h-[95dvh] sm:max-h-[92vh] flex flex-col animate-scaleIn overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-text-primary dark:text-stone-100">
                  {editingId ? 'Editar Pedido' : 'Novo Pedido'}
                </h2>
                {editingId && (
                  <p className="text-xs text-text-muted dark:text-stone-500 mt-0.5">
                    Altere os campos e salve para atualizar.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const orderRecord = (orders ?? []).find((o: any) => o.id === editingId)
                      if (orderRecord) handleGeneratePDF(orderRecord)
                    }}
                    disabled={generatingPdfId === editingId}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary-50 dark:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors"
                    title="Gerar PDF do pedido"
                  >
                    {generatingPdfId === editingId ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    PDF
                  </button>
                )}
                <button
                  onClick={() => { setShowModal(false); resetOrderForm() }}
                  className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body scrollable */}
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-5 space-y-5">

                {/* ── S1: Cliente ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <User size={12} /> Cliente
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomerMode('existing')}
                      className={clsx(
                        'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors',
                        customerMode === 'existing'
                          ? 'bg-primary text-white border-primary'
                          : 'bg-transparent text-text-muted border-border dark:border-border-dark hover:border-primary/40'
                      )}
                    >
                      <UserCheck size={14} /> Cliente cadastrado
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('new')}
                      className={clsx(
                        'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors',
                        customerMode === 'new'
                          ? 'bg-primary text-white border-primary'
                          : 'bg-transparent text-text-muted border-border dark:border-border-dark hover:border-primary/40'
                      )}
                    >
                      <UserPlus size={14} /> Novo cliente
                    </button>
                  </div>

                  {customerMode === 'existing' ? (
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                          <input
                            type="text"
                            className="input pl-9"
                            placeholder="Buscar cliente cadastrado..."
                            value={customerSearch}
                            onFocus={() => setShowCustomerPicker(true)}
                            onChange={e => { setCustomerSearch(e.target.value); setShowCustomerPicker(true) }}
                            autoComplete="off"
                          />
                          {showCustomerPicker && (
                            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-modal max-h-52 overflow-y-auto">
                              {(customers ?? [])
                                .filter((c: any) => customerSearch === '' || c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                                .slice(0, 8)
                                .map((c: any) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary/10 flex items-center justify-between gap-3 border-b border-border dark:border-border-dark last:border-0 transition-colors"
                                    onClick={() => {
                                      setValue('customer_id', c.id, { shouldValidate: true })
                                      setCustomerSearch(c.name)
                                      setShowCustomerPicker(false)
                                    }}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{c.name}</p>
                                      {c.phone && <p className="text-[10px] text-text-muted dark:text-stone-500">{c.phone}</p>}
                                    </div>
                                  </button>
                                ))}
                              {(customers ?? []).length === 0 && (
                                <p className="text-xs text-text-muted dark:text-stone-500 text-center py-3">Nenhum cliente cadastrado</p>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomerMode('new')}
                          className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold text-primary bg-primary-50 dark:bg-primary/10 hover:bg-primary-100 dark:hover:bg-primary/20 transition-colors flex-shrink-0"
                        >
                          <UserPlus size={13} /> Novo Cliente
                        </button>
                      </div>
                      {errors.customer_id && <p className="mt-1 text-xs text-error">{errors.customer_id.message}</p>}

                      {selectedCustomer && (
                        <div className="rounded-xl border border-border dark:border-border-dark p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div><span className="text-text-muted">Nome: </span><b className="text-text-primary dark:text-stone-100">{selectedCustomer.name}</b></div>
                          <div><span className="text-text-muted">Telefone: </span><b className="text-text-primary dark:text-stone-100">{selectedCustomer.phone || '—'}</b></div>
                          <div><span className="text-text-muted">WhatsApp: </span><b className="text-text-primary dark:text-stone-100">{selectedCustomer.phone || '—'}</b></div>
                          <div><span className="text-text-muted">E-mail: </span><b className="text-text-primary dark:text-stone-100">{selectedCustomer.email || '—'}</b></div>
                          <div><span className="text-text-muted">CPF/CNPJ: </span><b className="text-text-primary dark:text-stone-100">{selectedCustomer.cpf_cnpj || '—'}</b></div>
                          <div><span className="text-text-muted">Endereço: </span><b className="text-text-primary dark:text-stone-100">{[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(' — ') || '—'}</b></div>
                          {selectedCustomer.notes && (
                            <div className="sm:col-span-2"><span className="text-text-muted">Observações: </span><span className="text-text-primary dark:text-stone-100">{selectedCustomer.notes}</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-border dark:border-border-dark p-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Nome *</label>
                          <input type="text" className="input" placeholder="Nome completo" value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Telefone</label>
                          <input type="text" className="input" placeholder="(11) 99999-9999" value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">WhatsApp</label>
                          <input type="text" className="input" placeholder="(11) 99999-9999" value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">E-mail</label>
                          <input type="email" className="input" placeholder="email@exemplo.com" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">CPF/CNPJ</label>
                          <input type="text" className="input" value={newCustomer.cpf_cnpj} onChange={e => setNewCustomer(p => ({ ...p, cpf_cnpj: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Endereço</label>
                          <input type="text" className="input" value={newCustomer.address} onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Cidade</label>
                          <input type="text" className="input" value={newCustomer.city} onChange={e => setNewCustomer(p => ({ ...p, city: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Observações</label>
                          <textarea rows={2} className="input resize-none" value={newCustomer.notes} onChange={e => setNewCustomer(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setCustomerMode('existing')} className="btn-secondary flex-1">
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={!newCustomer.name.trim() || createCustomerMutation.isPending}
                          onClick={() => createCustomerMutation.mutate()}
                          className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {createCustomerMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                          {createCustomerMutation.isPending ? 'Salvando...' : 'Salvar cliente'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Observações do pedido</label>
                    <textarea rows={2} className="input resize-none" placeholder="Preferências, instruções especiais..." {...register('notes')} />
                  </div>
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── Arquivos do Cliente (arte) ── */}
                {editingId && companyId ? (
                  <>
                    <OrderFilesSection
                      orderId={editingId}
                      companyId={companyId}
                      customerName={selectedCustomer?.name}
                      customerPhone={selectedCustomer?.phone}
                      customerEmail={selectedCustomer?.email}
                    />
                    <div className="h-px bg-border dark:bg-border-dark" />
                  </>
                ) : (
                  <section className="rounded-xl border border-dashed border-border dark:border-border-dark p-4 text-center">
                    <FileText size={20} className="text-text-muted mx-auto mb-2" />
                    <p className="text-xs font-medium text-text-secondary dark:text-stone-400">Arquivos do Cliente</p>
                    <p className="text-[10px] text-text-muted dark:text-stone-500 mt-0.5">Salve o pedido para poder anexar arquivos de arte.</p>
                  </section>
                )}

                {/* ── S2: Produtos / Serviços (carrinho) ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <Package size={12} /> Produtos / Serviços
                  </h3>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        className="input pl-9"
                        placeholder="Buscar produto cadastrado..."
                        value={productSearch}
                        onFocus={() => setShowProductPicker(true)}
                        onChange={e => { setProductSearch(e.target.value); setShowProductPicker(true) }}
                        autoComplete="off"
                      />
                      {showProductPicker && (
                        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-modal max-h-52 overflow-y-auto">
                          {(productsList ?? [])
                            .filter((p: Record<string, unknown>) =>
                              productSearch === '' ||
                              (p.name as string).toLowerCase().includes(productSearch.toLowerCase())
                            )
                            .slice(0, 8)
                            .map((p: any) => (
                              <button
                                key={p.id as string}
                                type="button"
                                className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary/10 flex items-center justify-between gap-3 border-b border-border dark:border-border-dark last:border-0 transition-colors"
                                onClick={() => addItemFromProduct(p)}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-text-primary dark:text-stone-100 leading-snug break-words">{p.name as string}</p>
                                  <p className="text-[10px] text-text-muted dark:text-stone-500">{p.category as string}</p>
                                </div>
                                <span className="text-sm font-bold text-primary flex-shrink-0">
                                  {fmtGlobal(Number(p.final_price))}
                                </span>
                              </button>
                            ))}
                          {(productsList ?? []).length === 0 && (
                            <p className="text-xs text-text-muted dark:text-stone-500 text-center py-3">Nenhum produto cadastrado</p>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={addManualItem}
                      className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold text-primary bg-primary-50 dark:bg-primary/10 hover:bg-primary-100 dark:hover:bg-primary/20 transition-colors flex-shrink-0"
                    >
                      <Plus size={13} /> Produto manual
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border dark:border-border-dark p-5 text-center">
                      <Package size={20} className="text-text-muted mx-auto mb-2" />
                      <p className="text-xs text-text-muted">Nenhum produto adicionado ainda.</p>
                      <p className="text-[10px] text-text-muted/70 mt-0.5">Busque um produto cadastrado ou clique em &quot;Produto manual&quot;.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-border dark:border-border-dark p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">{item.name || 'Item sem nome'}</p>
                              {item.description && <p className="text-[11px] text-text-muted mt-0.5 break-words">{item.description}</p>}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-text-muted">
                                <span>Qtd: <b className="text-text-primary dark:text-stone-200">{item.quantity}</b></span>
                                <span>Valor: <b className="text-text-primary dark:text-stone-200">{fmtGlobal(item.unit_price)}</b></span>
                                {item.discount > 0 && (
                                  <span>Desconto: <b className="text-text-primary dark:text-stone-200">{item.discount_type === 'percentage' ? `${item.discount}%` : fmtGlobal(item.discount)}</b></span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-sm font-bold text-primary mr-1">{fmtGlobal(item.subtotal)}</span>
                              <button type="button" onClick={() => openEditItem(item)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors" title="Editar">
                                <Edit2 size={13} />
                              </button>
                              <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors" title="Excluir">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S3: Totais ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <DollarSign size={12} /> Totais
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Subtotal (R$)</label>
                      <div className="input bg-stone-50 dark:bg-stone-800/50 flex items-center text-text-secondary dark:text-stone-400">
                        {fmtGlobal(Number(watch('subtotal') || 0))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Desconto Geral (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" placeholder="0,00" {...register('discount')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Frete (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" placeholder="0,00" {...register('delivery_fee')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Acréscimos (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" placeholder="0,00" {...register('additional_charges')} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                    <span className="text-sm font-medium text-text-secondary dark:text-stone-400">Total do pedido</span>
                    <span className="text-xl font-bold text-primary">
                      {fmtGlobal(Number(watch('total') || 0))}
                    </span>
                  </div>
                  <input type="hidden" {...register('subtotal')} />
                  <input type="hidden" {...register('total')} />
                </section>

                {items.length > 0 && (
                  <>
                    <div className="h-px bg-border dark:bg-border-dark" />

                    {/* ── Resumo do Pedido ── */}
                    <section className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                        <FileText size={12} /> Resumo do Pedido
                      </h3>
                      <div className="rounded-xl border border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark overflow-hidden">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between px-3.5 py-2 text-xs">
                            <span className="text-text-secondary dark:text-stone-300 truncate pr-2">
                              {item.name} <span className="text-text-muted">· {item.quantity} un</span>
                            </span>
                            <span className="font-semibold text-text-primary dark:text-stone-100 flex-shrink-0">{fmtGlobal(item.subtotal)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-3.5 py-2 text-xs bg-stone-50 dark:bg-stone-800/40">
                          <span className="text-text-muted">Subtotal</span>
                          <span className="font-medium text-text-primary dark:text-stone-100">{fmtGlobal(Number(watch('subtotal') || 0))}</span>
                        </div>
                        {Number(watch('discount') || 0) > 0 && (
                          <div className="flex items-center justify-between px-3.5 py-2 text-xs">
                            <span className="text-text-muted">Desconto</span>
                            <span className="font-medium text-green-700 dark:text-green-400">− {fmtGlobal(Number(watch('discount')))}</span>
                          </div>
                        )}
                        {Number(watch('delivery_fee') || 0) > 0 && (
                          <div className="flex items-center justify-between px-3.5 py-2 text-xs">
                            <span className="text-text-muted">Frete</span>
                            <span className="font-medium text-text-primary dark:text-stone-100">+ {fmtGlobal(Number(watch('delivery_fee')))}</span>
                          </div>
                        )}
                        {Number(watch('additional_charges') || 0) > 0 && (
                          <div className="flex items-center justify-between px-3.5 py-2 text-xs">
                            <span className="text-text-muted">Acréscimos</span>
                            <span className="font-medium text-text-primary dark:text-stone-100">+ {fmtGlobal(Number(watch('additional_charges')))}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-3.5 py-2.5 bg-primary-50 dark:bg-primary/10">
                          <span className="text-xs font-bold uppercase tracking-wide text-text-secondary dark:text-stone-300">Total</span>
                          <span className="text-sm font-bold text-primary">{fmtGlobal(Number(watch('total') || 0))}</span>
                        </div>
                      </div>
                    </section>
                  </>
                )}

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S4: Prazos & Status ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <Clock size={12} /> Prazos &amp; Status
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Data do pedido</label>
                      <input type="date" className="input" {...register('order_date')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Prazo de entrega</label>
                      <input type="date" className="input" {...register('due_date')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Status</label>
                      <select className="input" {...register('status')}>
                        <option value="pending">Pendente</option>
                        <option value="production">Produção</option>
                        <option value="ready">Pronto</option>
                        <option value="delivered">Entregue</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Prioridade</label>
                      <select className="input" {...register('priority')}>
                        <option value="low">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S5: Forma de pagamento preferida (informativa) ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <CreditCard size={12} /> Forma de Pagamento Preferida
                  </h3>
                  <div>
                    <select className="input" {...register('payment_method')}>
                      <option value="">Não definido</option>
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao_credito">Cartão Crédito</option>
                      <option value="cartao_debito">Cartão Débito</option>
                      <option value="transferencia">Transferência</option>
                      <option value="boleto">Boleto</option>
                      <option value="outro">Outro</option>
                    </select>
                    <p className="mt-1 text-[10px] text-text-muted dark:text-stone-500">
                      Para registrar recebimentos, use a seção abaixo.
                    </p>
                  </div>
                </section>

                {/* ── S6: Histórico de Recebimentos (somente ao editar) ── */}
                {editingId && (
                  <>
                    <div className="h-px bg-border dark:bg-border-dark" />

                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                          <History size={12} /> Histórico de Recebimentos
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPaymentId(null)
                            resetPayment({ fill_type: 'amount', amount: 0, percentage: 0, payment_date: new Date().toISOString().split('T')[0], payment_method: '', observation: '' })
                            setAmountDisplayText('')
                            setPercentageDisplayText('')
                            setShowPaymentModal(true)
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary-50 dark:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          <PlusCircle size={13} />
                          Registrar Recebimento
                        </button>
                      </div>

                      {/* Resumo financeiro */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-border dark:border-border-dark p-3">
                          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Valor Total</p>
                          <p className="text-sm font-bold text-text-primary dark:text-stone-100">{fmtGlobal(orderTotal)}</p>
                        </div>
                        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/30 p-3">
                          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Recebido</p>
                          <p className="text-sm font-bold text-green-700 dark:text-green-400">{fmtGlobal(totalReceived)}</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 p-3">
                          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Saldo</p>
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmtGlobal(saldoRestante)}</p>
                        </div>
                        <div className="rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20 p-3">
                          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Recebido</p>
                          <p className="text-sm font-bold text-primary">{pctRecebido.toFixed(0)}%</p>
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all duration-500',
                            pctRecebido >= 100 ? 'bg-green-500' : pctRecebido > 0 ? 'bg-amber-500' : 'bg-stone-300'
                          )}
                          style={{ width: `${Math.min(100, pctRecebido)}%` }}
                        />
                      </div>

                      {/* Status badge automático */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {pctRecebido >= 100 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
                            <CheckCircle2 size={11} /> Recebido
                          </span>
                        ) : pctRecebido > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">
                            <AlertCircle size={11} /> Recebimento Parcial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-full">
                            <Clock size={11} /> Não pago
                          </span>
                        )}
                        {(() => {
                          const paidAt = (orders ?? []).find((o: any) => o.id === editingId)?.paid_at
                          return pctRecebido >= 100 && paidAt ? (
                            <span className="text-[10px] text-text-muted">
                              Quitado em {format(parseISO(paidAt), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          ) : null
                        })()}
                      </div>

                      {/* Tabela de recebimentos */}
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 size={16} className="animate-spin text-text-muted" />
                        </div>
                      ) : (paymentHistory ?? []).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border dark:border-border-dark p-4 text-center">
                          <History size={18} className="text-text-muted mx-auto mb-1.5" />
                          <p className="text-xs text-text-muted">Nenhum recebimento registrado ainda.</p>
                          <p className="text-[10px] text-text-muted/70 mt-0.5">Clique em &quot;Registrar Recebimento&quot; para adicionar.</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border dark:border-border-dark overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-stone-50 dark:bg-stone-800/50 text-[10px] uppercase tracking-wide text-text-muted">
                                <th className="text-left font-semibold px-3 py-2">Data</th>
                                <th className="text-left font-semibold px-3 py-2">Forma</th>
                                <th className="text-right font-semibold px-3 py-2">Valor</th>
                                <th className="text-right font-semibold px-3 py-2">%</th>
                                <th className="text-left font-semibold px-3 py-2">Observação</th>
                                <th className="text-left font-semibold px-3 py-2">Usuário</th>
                                <th className="text-right font-semibold px-3 py-2">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(paymentHistory ?? []).map((p, idx) => {
                                const pct = p.percentage != null ? Number(p.percentage) : (orderTotal > 0 ? (Number(p.amount) / orderTotal) * 100 : 0)
                                return (
                                <tr
                                  key={p.id}
                                  className={clsx(idx !== 0 && 'border-t border-border dark:border-border-dark')}
                                >
                                  <td className="px-3 py-2.5 whitespace-nowrap font-medium text-text-primary dark:text-stone-100">
                                    {format(parseISO(p.payment_date), 'dd/MM/yyyy', { locale: ptBR })}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                                    {p.payment_method ? formatMethod(p.payment_method) : '—'}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-right font-bold text-green-700 dark:text-green-400">
                                    {fmtGlobal(Number(p.amount))}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-right text-text-muted">
                                    {pct.toFixed(2).replace('.', ',')}%
                                  </td>
                                  <td className="px-3 py-2.5 text-text-muted dark:text-stone-500 max-w-[160px] truncate" title={p.observation ?? ''}>
                                    {p.observation || '—'}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-text-muted">
                                    {(p.created_by && paymentUserNames?.[p.created_by]) || '—'}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setViewingPaymentId(p.id)}
                                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
                                        title="Ver detalhes"
                                      >
                                        <Eye size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const editPct = Math.round(pct * 100) / 100
                                          setEditingPaymentId(p.id)
                                          resetPayment({
                                            fill_type: 'amount',
                                            amount: Number(p.amount),
                                            percentage: editPct,
                                            payment_date: p.payment_date,
                                            payment_method: p.payment_method ?? '',
                                            observation: p.observation ?? '',
                                          })
                                          setAmountDisplayText(formatDecimalPtBR(Number(p.amount)))
                                          setPercentageDisplayText(formatDecimalPtBR(editPct))
                                          setShowPaymentModal(true)
                                        }}
                                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-white/5 transition-colors"
                                        title="Editar recebimento"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeletePaymentId(p.id)}
                                        className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors"
                                        title="Excluir recebimento"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )})}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </>
                )}

              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark bg-white dark:bg-surface-dark sticky bottom-0">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOrderId(editingId)}
                    className="p-2.5 rounded-xl text-error border border-error/30 hover:bg-error-light dark:hover:bg-error/10 transition-colors flex-shrink-0"
                    title="Excluir pedido"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetOrderForm() }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          MODAL EDITAR ITEM DO PEDIDO
      ══════════════════════════════════ */}

      {editingItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingItem(null)}
          />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-md animate-scaleIn overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
              <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                {editingItem.product_id ? 'Editar produto' : 'Produto manual'}
              </h2>
              <button onClick={() => setEditingItem(null)} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
                <X size={15} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Nome *</label>
                <input
                  className="input"
                  value={editingItem.name}
                  onChange={e => setEditingItem(p => p ? { ...p, name: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Descrição</label>
                <input
                  className="input text-sm"
                  value={editingItem.description}
                  onChange={e => setEditingItem(p => p ? { ...p, description: e.target.value } : null)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Qtd</label>
                  <input
                    type="number" min="1" step="1" className="input text-sm"
                    value={editingItem.quantity}
                    onChange={e => setEditingItem(p => p ? { ...p, quantity: Number(e.target.value) } : null)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Valor unit.</label>
                  <input
                    type="number" step="0.01" min="0" className="input text-sm"
                    value={editingItem.unit_price}
                    onChange={e => setEditingItem(p => p ? { ...p, unit_price: Number(e.target.value) } : null)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Desconto</label>
                  <input
                    type="number" min="0" step="0.01"
                    max={editingItem.discount_type === 'percentage' ? 100 : undefined}
                    className="input text-sm"
                    value={editingItem.discount}
                    onChange={e => setEditingItem(p => p ? { ...p, discount: Number(e.target.value) } : null)}
                  />
                  {(() => {
                    const gross = editingItem.quantity * editingItem.unit_price
                    const discValue = editingItem.discount_type === 'percentage'
                      ? gross * (editingItem.discount / 100)
                      : editingItem.discount
                    return discValue > gross && gross > 0 ? (
                      <p className="mt-1 text-[11px] text-warning">
                        Desconto maior que o valor do item — será limitado a {fmtGlobal(gross)}.
                      </p>
                    ) : null
                  })()}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(p => p ? { ...p, discount_type: 'amount' } : null)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    editingItem.discount_type === 'amount'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-transparent text-text-muted border-border dark:border-border-dark'
                  )}
                >
                  R$
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(p => p ? { ...p, discount_type: 'percentage' } : null)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    editingItem.discount_type === 'percentage'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-transparent text-text-muted border-border dark:border-border-dark'
                  )}
                >
                  %
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowItemTechDetails(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary"
              >
                {showItemTechDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Detalhes técnicos
              </button>

              {showItemTechDetails && (
                <div className="space-y-2.5 rounded-xl border border-border dark:border-border-dark p-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-text-primary dark:text-stone-200 mb-1">
                        <Ruler size={11} /> Largura
                      </label>
                      <input
                        type="number" step="0.01" min="0" className="input text-sm"
                        value={editingItem.width ?? ''}
                        onChange={e => setEditingItem(p => p ? { ...p, width: e.target.value ? Number(e.target.value) : undefined } : null)}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-text-primary dark:text-stone-200 mb-1">
                        <Ruler size={11} /> Altura
                      </label>
                      <input
                        type="number" step="0.01" min="0" className="input text-sm"
                        value={editingItem.height ?? ''}
                        onChange={e => setEditingItem(p => p ? { ...p, height: e.target.value ? Number(e.target.value) : undefined } : null)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-text-primary dark:text-stone-200 mb-1">
                      <Scissors size={11} /> Acabamentos <span className="font-normal text-text-muted">(separe por vírgula)</span>
                    </label>
                    <input
                      className="input text-sm"
                      value={(editingItem.finishings ?? []).join(', ')}
                      onChange={e => setEditingItem(p => p ? { ...p, finishings: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : null)}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-text-primary dark:text-stone-200 mb-1">
                      <Box size={11} /> Finalização
                    </label>
                    <select
                      className="input text-sm"
                      value={editingItem.finishing_type ?? ''}
                      onChange={e => setEditingItem(p => p ? { ...p, finishing_type: e.target.value || undefined } : null)}
                    >
                      <option value="">Selecionar...</option>
                      {FINISHING_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1">Observações técnicas</label>
                    <textarea
                      rows={2}
                      className="input text-sm resize-none"
                      value={editingItem.technical_notes ?? ''}
                      onChange={e => setEditingItem(p => p ? { ...p, technical_notes: e.target.value } : null)}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                <span className="text-sm font-medium text-text-secondary dark:text-stone-400">Subtotal</span>
                <span className="text-lg font-bold text-primary">{fmtGlobal(computeItemSubtotal(editingItem))}</span>
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
              <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                type="button"
                disabled={!editingItem.name.trim()}
                onClick={() => saveEditItem(editingItem)}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Salvar item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          MODAL REGISTRAR RECEBIMENTO
      ══════════════════════════════════ */}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setShowPaymentModal(false); setEditingPaymentId(null); resetPayment(); setAmountDisplayText(''); setPercentageDisplayText('') }}
          />

          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign size={16} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">
                    {editingPaymentId ? 'Editar Recebimento' : 'Registrar Recebimento'}
                  </h2>
                  <p className="text-[11px] text-text-muted">Saldo restante: {fmtGlobal(modalMaxAmount)}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowPaymentModal(false); setEditingPaymentId(null); resetPayment(); setAmountDisplayText(''); setPercentageDisplayText('') }}
                className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={handleSubmitPayment(d => {
                if (editingPaymentId) updatePaymentMutation.mutate(d)
                else registerPaymentMutation.mutate(d)
              })}
              className="p-4 sm:p-5 space-y-4"
            >

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                  Tipo de preenchimento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentValue('fill_type', 'amount')}
                    className={clsx(
                      'flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors',
                      paymentFillType === 'amount'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-transparent text-text-muted border-border dark:border-border-dark hover:border-primary/40'
                    )}
                  >
                    <DollarSign size={13} /> Valor (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentValue('fill_type', 'percentage')}
                    className={clsx(
                      'flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors',
                      paymentFillType === 'percentage'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-transparent text-text-muted border-border dark:border-border-dark hover:border-primary/40'
                    )}
                  >
                    <Percent size={13} /> Porcentagem (%)
                  </button>
                </div>
              </div>

              {paymentFillType === 'amount' ? (
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Valor recebido (R$) *
                  </label>
                  <input
                    key="amount-input"
                    type="text"
                    inputMode="decimal"
                    className="input text-lg font-semibold"
                    placeholder="0,00"
                    value={amountDisplayText}
                    onChange={(e) => handleAmountInputChange(e.target.value)}
                  />
                  {paymentErrors.amount && <p className="mt-1 text-xs text-error">{paymentErrors.amount.message}</p>}
                  <p className="mt-1 text-[11px] text-text-muted">
                    Equivale a: {percentageDisplayText || '0'}% do pedido
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Percentual recebido (%) *
                  </label>
                  <input
                    key="percentage-input"
                    type="text"
                    inputMode="decimal"
                    className="input text-lg font-semibold"
                    placeholder="0,00"
                    value={percentageDisplayText}
                    onChange={(e) => handlePercentageInputChange(e.target.value)}
                  />
                  {paymentErrors.amount && <p className="mt-1 text-xs text-error">{paymentErrors.amount.message}</p>}
                  <p className="mt-1 text-[11px] text-text-muted">
                    Equivale a: {fmtGlobal(parseDecimalPtBR(amountDisplayText))}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Data *</label>
                <input type="date" className="input" {...registerPayment('payment_date')} />
                {paymentErrors.payment_date && <p className="mt-1 text-xs text-error">{paymentErrors.payment_date.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Forma de pagamento</label>
                <select className="input" {...registerPayment('payment_method')}>
                  <option value="">Selecionar...</option>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                  <option value="cartao_debito">Cartão Débito</option>
                  <option value="transferencia">Transferência</option>
                  <option value="boleto">Boleto</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Observação</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Entrada, Pagamento da arte, Pagamento final, Saldo..."
                  {...registerPayment('observation')}
                />
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); setEditingPaymentId(null); resetPayment(); setAmountDisplayText(''); setPercentageDisplayText('') }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={registerPaymentMutation.isPending || updatePaymentMutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {(registerPaymentMutation.isPending || updatePaymentMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
                  {editingPaymentId
                    ? (updatePaymentMutation.isPending ? 'Salvando...' : 'Salvar alterações')
                    : (registerPaymentMutation.isPending ? 'Registrando...' : 'Registrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          MODAL VER DETALHES DO RECEBIMENTO
      ══════════════════════════════════ */}

      {viewingPaymentId && (() => {
        const vp = (paymentHistory ?? []).find(p => p.id === viewingPaymentId)
        if (!vp) return null
        const vpPct = vp.percentage != null ? Number(vp.percentage) : (orderTotal > 0 ? (Number(vp.amount) / orderTotal) * 100 : 0)
        const responsibleName = (vp.created_by && paymentUserNames?.[vp.created_by]) || '—'
        const wasEdited = vp.updated_at && vp.created_at && vp.updated_at !== vp.created_at

        const ACTION_LABELS: Record<string, string> = { create: 'Criado', update: 'Editado', delete: 'Excluído' }

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewingPaymentId(null)}
            />
            <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-md animate-scaleIn overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
                    <Eye size={16} className="text-primary" />
                  </div>
                  <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Detalhes do Recebimento</h2>
                </div>
                <button
                  onClick={() => setViewingPaymentId(null)}
                  className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/30 p-3">
                    <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Valor</p>
                    <p className="text-sm font-bold text-green-700 dark:text-green-400">{fmtGlobal(Number(vp.amount))}</p>
                  </div>
                  <div className="rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20 p-3">
                    <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Porcentagem</p>
                    <p className="text-sm font-bold text-primary">{vpPct.toFixed(2).replace('.', ',')}%</p>
                  </div>
                </div>

                <dl className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-text-muted">Forma de pagamento</dt>
                    <dd className="font-medium text-text-primary dark:text-stone-100">{vp.payment_method ? formatMethod(vp.payment_method) : '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-text-muted">Data</dt>
                    <dd className="font-medium text-text-primary dark:text-stone-100">{format(parseISO(vp.payment_date), 'dd/MM/yyyy', { locale: ptBR })}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-text-muted flex-shrink-0">Observação</dt>
                    <dd className="font-medium text-text-primary dark:text-stone-100 text-right">{vp.observation || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-text-muted">Usuário responsável</dt>
                    <dd className="font-medium text-text-primary dark:text-stone-100">{responsibleName}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-text-muted">Data de criação</dt>
                    <dd className="font-medium text-text-primary dark:text-stone-100">
                      {vp.created_at ? format(parseISO(vp.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-text-muted">Última alteração</dt>
                    <dd className="font-medium text-text-primary dark:text-stone-100">
                      {wasEdited ? format(parseISO(vp.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="h-px bg-border dark:bg-border-dark" />

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2 mb-2">
                    <History size={12} /> Histórico de Alterações (Auditoria)
                  </h3>
                  {(viewingPaymentAudit ?? []).length === 0 ? (
                    <p className="text-[11px] text-text-muted">Nenhum registro de auditoria encontrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {(viewingPaymentAudit ?? []).map(a => (
                        <div key={a.id} className="rounded-xl border border-border dark:border-border-dark p-2.5 text-[11px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-text-primary dark:text-stone-100">{ACTION_LABELS[a.action] ?? a.action}</span>
                            <span className="text-text-muted">
                              {format(parseISO(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-text-muted">
                            Por: {(a.performed_by && auditUserNames?.[a.performed_by]) || 'Usuário'}
                          </p>
                          {a.action === 'update' && (
                            <p className="text-text-muted mt-0.5">
                              Valor: {fmtGlobal(Number(a.old_amount ?? 0))} → {fmtGlobal(Number(a.new_amount ?? 0))}
                              {a.old_payment_method !== a.new_payment_method && (
                                <> · Forma: {formatMethod(a.old_payment_method) || '—'} → {formatMethod(a.new_payment_method) || '—'}</>
                              )}
                            </p>
                          )}
                          {a.action === 'create' && (
                            <p className="text-text-muted mt-0.5">
                              Valor inicial: {fmtGlobal(Number(a.new_amount ?? 0))}
                            </p>
                          )}
                          {a.action === 'delete' && (
                            <p className="text-text-muted mt-0.5">
                              Valor excluído: {fmtGlobal(Number(a.old_amount ?? 0))}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
                <button type="button" onClick={() => setViewingPaymentId(null)} className="btn-secondary w-full">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══════════════════════════════════
          MODAL CONFIRMAR EXCLUSÃO DE PEDIDO
      ══════════════════════════════════ */}

      {confirmDeleteOrderId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleteMutation.isPending && setConfirmDeleteOrderId(null)}
          />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn overflow-hidden p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-error-light flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-error" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Excluir pedido</h2>
                <p className="text-xs text-text-muted mt-0.5">Deseja realmente excluir este pedido?</p>
              </div>
            </div>
            <p className="text-[11px] text-text-muted mb-4">
              Esta ação não pode ser desfeita. Itens do pedido, recebimentos, arquivos de arte e o
              evento de entrega na agenda vinculados a ele também serão removidos.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setConfirmDeleteOrderId(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDeleteOrderId)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-error text-white text-sm font-semibold py-2.5 hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Excluir pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          MODAL CONFIRMAR EXCLUSÃO DE RECEBIMENTO
      ══════════════════════════════════ */}

      {confirmDeletePaymentId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDeletePaymentId(null)}
          />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn overflow-hidden p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-error-light flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-error" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary dark:text-stone-100">Excluir recebimento</h2>
                <p className="text-xs text-text-muted mt-0.5">Tem certeza que deseja excluir este recebimento?</p>
              </div>
            </div>
            <p className="text-[11px] text-text-muted mb-4">
              A receita correspondente no Financeiro também será removida e o saldo do pedido será recalculado.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeletePaymentId(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletePaymentMutation.isPending}
                onClick={() => {
                  const id = confirmDeletePaymentId
                  setConfirmDeletePaymentId(null)
                  if (id) deletePaymentMutation.mutate(id)
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-error text-white text-sm font-semibold py-2.5 hover:bg-error/90 transition-colors"
              >
                {deletePaymentMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Excluir recebimento
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
