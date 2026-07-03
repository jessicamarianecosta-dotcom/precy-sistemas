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
} from 'lucide-react'

import { useForm } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'

import { z } from 'zod'

import { clsx } from 'clsx'

import { format, parseISO } from 'date-fns'

import { ptBR } from 'date-fns/locale'
import { formatCurrency as fmtGlobal } from '@/lib/utils/format'
import { useSubscription } from '@/hooks/useSubscription'

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
  customer_id: z.string().min(1, 'Selecione um cliente'),
  service_name: z.string().min(2, 'Informe o serviço'),
  description: z.string().optional(),
  status: z.string().default('pending'),
  subtotal: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
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

  /* Product picker */
  const [productSearch, setProductSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)

  /* Payment registration modal */
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)
  const [viewingPaymentId, setViewingPaymentId] = useState<string | null>(null)
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null)
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

  const { data: customers } = useQuery({
    queryKey: ['customers-select', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const response: any = await supabase
        .from('customers')
        .select('id, name')
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
        .select('id, name, final_price, category, description')
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

  useEffect(() => {
    setValue('total', Math.max(0, Number(subtotal) - Number(discount)))
  }, [subtotal, discount, setValue])

  /* ─────────────────────────────────────────────
     SINCRONIA VALOR ⇄ PORCENTAGEM (modal de recebimento)
  ───────────────────────────────────────────── */

  const paymentFillType = watchPayment('fill_type')
  const paymentAmountField = watchPayment('amount')
  const paymentPercentageField = watchPayment('percentage')

  useEffect(() => {
    if (paymentFillType !== 'amount') return
    const total = Number(watch('total')) || 0
    const pct = total > 0 ? (Number(paymentAmountField || 0) / total) * 100 : 0
    setPaymentValue('percentage', Math.round(pct * 100) / 100, { shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentAmountField, paymentFillType])

  useEffect(() => {
    if (paymentFillType !== 'percentage') return
    const total = Number(watch('total')) || 0
    const amt = total > 0 ? (Number(paymentPercentageField || 0) / 100) * total : 0
    setPaymentValue('amount', Math.round(amt * 100) / 100, { shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentPercentageField, paymentFillType])

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
     SAVE ORDER
  ───────────────────────────────────────────── */

  function buildOrderPayload(data: FormData) {
    return {
      customer_id: data.customer_id,
      service_name: data.service_name || '',
      description: data.description || null,
      status: data.status || 'pending',
      payment_method: data.payment_method || null,
      subtotal: Number(data.subtotal) || 0,
      discount: Number(data.discount) || 0,
      total: Number(data.total) || 0,
      notes: data.notes || null,
      due_date: data.due_date || null,
      priority: data.priority || 'normal',
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
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

      if (editingId) {
        const { error } = await (supabase.from('orders') as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await (supabase.from('orders') as any)
          .insert([{ ...payload, company_id: companyId!, order_number: '' }])
        if (error) throw new Error(error.message)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      setShowModal(false)
      reset()
      setEditingId(null)
      setEditingPaymentId(null)
      toast('success', editingId ? 'Pedido atualizado!' : 'Pedido criado!')
    },

    onError: (err: Error) => {
      toast('error', `Erro: ${err.message}`)
    },
  })

  /* ─────────────────────────────────────────────
     HELPERS — recálculo de saldo/status/quitação
  ───────────────────────────────────────────── */

  /** Recalcula payment_status + paid_at do pedido a partir do SUM atual do payment_history. */
  async function recalcOrderPaymentStatus(orderId: string, orderTotalValue: number, currentPaidAt: string | null) {
    const { data: rows } = await (supabase.from('payment_history') as any)
      .select('amount')
      .eq('order_id', orderId)
      .eq('company_id', companyId!)
    const total = (rows ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)

    let status: string
    if (orderTotalValue > 0 && total >= orderTotalValue) status = 'paid'
    else if (total > 0) status = 'partial'
    else status = 'pending'

    const isPaid = status === 'paid'
    await (supabase.from('orders') as any)
      .update({
        payment_status: status,
        paid_at: isPaid ? (currentPaidAt ?? new Date().toISOString()) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    return status
  }

  /** Recalcula total_purchases do cliente somando apenas pedidos 100% pagos. */
  async function recalcCustomerTotalPurchases(customerId: string) {
    const { data: clientOrders } = await (supabase.from('orders') as any)
      .select('total')
      .eq('customer_id', customerId)
      .eq('company_id', companyId!)
      .eq('payment_status', 'paid')
    const totalPurchases = (clientOrders ?? []).reduce((s: number, o: any) => s + Number(o.total), 0)
    await (supabase.from('customers') as any)
      .update({ total_purchases: totalPurchases, updated_at: new Date().toISOString() })
      .eq('id', customerId)
  }

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
          ? 'O percentual informado é maior que o saldo restante.'
          : 'O valor informado é maior que o saldo restante.'
        throw new Error(`${msg} Máximo permitido: ${fmtGlobal(orderTotalValue - alreadyReceived)}`)
      }

      const percentage = orderTotalValue > 0 ? (amount / orderTotalValue) * 100 : 0

      /* 1. Inserir no payment_history — SEMPRE INSERT, nunca UPDATE */
      const { data: phData, error: phError } = await (supabase.from('payment_history') as any).insert([{
        order_id: editingId,
        customer_id: orderRecord.customer_id,
        company_id: companyId,
        amount,
        payment_date: paymentData.payment_date,
        payment_method: paymentData.payment_method || null,
        observation: paymentData.observation || null,
        percentage,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }]).select('id').single()
      if (phError) throw new Error(`Erro ao registrar recebimento: ${phError.message}`)

      /* 2. Inserir lançamento INDIVIDUAL no financeiro — nunca atualizar anterior */
      const { error: ftError } = await (supabase.from('financial_transactions') as any).insert([{
        company_id: companyId,
        order_id: editingId,
        payment_history_id: phData?.id ?? null,
        type: 'income',
        category: 'vendas',
        amount,
        description: `Recebimento — Pedido ${orderRecord.order_number || ''} · ${orderRecord.service_name || 'Serviço'}${paymentData.observation ? ' · ' + paymentData.observation : ''}`,
        date: paymentData.payment_date,
        status: 'received',
        client_name: orderRecord.customers?.name || null,
      }])
      if (ftError) throw new Error(`Erro ao lançar no financeiro: ${ftError.message}`)

      /* 3. Recalcular payment_status/paid_at a partir do SUM do payment_history */
      const newPaymentStatus = await recalcOrderPaymentStatus(editingId, orderTotalValue, orderRecord.paid_at ?? null)

      /* 4. Atualizar total_purchases do cliente */
      if (orderRecord.customer_id) {
        await recalcCustomerTotalPurchases(orderRecord.customer_id)
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
          ? 'O percentual informado é maior que o saldo restante.'
          : 'O valor informado é maior que o saldo restante.'
        throw new Error(`${msg} Máximo permitido: ${fmtGlobal(orderTotalValue - alreadyReceived)}`)
      }

      const percentage = orderTotalValue > 0 ? (amount / orderTotalValue) * 100 : 0

      /* 1. Atualizar payment_history */
      const { error: phError } = await (supabase.from('payment_history') as any)
        .update({
          amount,
          payment_date: paymentData.payment_date,
          payment_method: paymentData.payment_method || null,
          observation: paymentData.observation || null,
          percentage,
        })
        .eq('id', editingPaymentId)
      if (phError) throw new Error(`Erro ao editar recebimento: ${phError.message}`)

      /* 2. Atualizar o lançamento vinculado no financeiro */
      const { error: ftError } = await (supabase.from('financial_transactions') as any)
        .update({
          amount,
          date: paymentData.payment_date,
          description: `Recebimento — Pedido ${orderRecord.order_number || ''} · ${orderRecord.service_name || 'Serviço'}${paymentData.observation ? ' · ' + paymentData.observation : ''}`,
          updated_at: new Date().toISOString(),
        })
        .eq('payment_history_id', editingPaymentId)
      if (ftError) throw new Error(`Erro ao atualizar lançamento no financeiro: ${ftError.message}`)

      /* 3. Recalcular payment_status/paid_at e total_purchases */
      await recalcOrderPaymentStatus(editingId, orderTotalValue, orderRecord.paid_at ?? null)
      if (orderRecord.customer_id) {
        await recalcCustomerTotalPurchases(orderRecord.customer_id)
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

      /* 1. Remover o lançamento vinculado no financeiro */
      const { error: ftError } = await (supabase.from('financial_transactions') as any)
        .delete()
        .eq('payment_history_id', paymentId)
      if (ftError) throw new Error(`Erro ao remover lançamento do financeiro: ${ftError.message}`)

      /* 2. Remover o recebimento */
      const { error: phError } = await (supabase.from('payment_history') as any)
        .delete()
        .eq('id', paymentId)
      if (phError) throw new Error(`Erro ao excluir recebimento: ${phError.message}`)

      /* 3. Recalcular payment_status/paid_at e total_purchases */
      await recalcOrderPaymentStatus(editingId, Number(orderRecord.total), orderRecord.paid_at ?? null)
      if (orderRecord.customer_id) {
        await recalcCustomerTotalPurchases(orderRecord.customer_id)
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
      await (supabase.from('orders') as any).delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', companyId] })
      toast('success', 'Pedido removido!')
    },
  })

  /* ─────────────────────────────────────────────
     OPEN ORDER
  ───────────────────────────────────────────── */

  function openOrder(order: Record<string, unknown>) {
    setEditingId(order.id as string)
    setEditingPaymentId(null)
    const fields = [
      'customer_id', 'service_name', 'description', 'status',
      'subtotal', 'discount', 'total', 'notes',
      'due_date', 'priority', 'payment_method',
      'product_id', 'order_date',
    ]
    fields.forEach(k => {
      const val = order[k]
      if (val !== undefined && val !== null) setValue(k as never, val as never)
    })
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

      const productId = (fullOrder ?? order).product_id as string | undefined
      const { data: productData } = productId
        ? await (supabase.from('products') as any).select('name, description').eq('id', productId).single()
        : { data: null }

      const { data: payments } = await (supabase.from('payment_history') as any)
        .select('*')
        .eq('order_id', orderId)
        .order('payment_date', { ascending: true })

      await generateOrderPDF({
        order: fullOrder ?? order,
        product: productData,
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
     RENDER
  ───────────────────────────────────────────── */

  return (
    <div className="page-enter">

      <Header title="Pedidos" subtitle="Acompanhamento de produção" />

      <div className="p-3 sm:p-5 lg:p-6 space-y-4">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
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

          <button
            onClick={() => { reset(); setEditingId(null); setEditingPaymentId(null); setShowModal(true) }}
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
            action={{ label: '+ Novo Pedido', onClick: () => setShowModal(true) }}
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
                    <button
                      onClick={(e) => { e.stopPropagation(); openOrder(order) }}
                      className="p-1.5 rounded-xl text-text-muted hover:text-primary hover:bg-primary-50 flex-shrink-0 self-center"
                    >
                      <Edit2 size={13} />
                    </button>
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
                                <span className="text-[10px] font-mono text-text-muted">{order.order_number || '—'}</span>
                                <GripVertical size={11} className="text-text-muted/50 flex-shrink-0" />
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
            <div className="hidden sm:grid grid-cols-2 xl:grid-cols-4 gap-3">
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
                                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(order.id) }}
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
                  onClick={() => { setShowModal(false); reset(); setEditingId(null); setEditingPaymentId(null); setShowProductPicker(false) }}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Cliente *</label>
                      <select className="input" {...register('customer_id')}>
                        <option value="">Selecione um cliente...</option>
                        {(customers ?? []).map((c: Record<string, string>) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {errors.customer_id && <p className="mt-1 text-xs text-error">{errors.customer_id.message}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Observações do cliente</label>
                      <textarea rows={2} className="input resize-none" placeholder="Preferências, instruções especiais..." {...register('notes')} />
                    </div>
                  </div>
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S2: Produto / Serviço ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <Package size={12} /> Produto / Serviço
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                      Nome do produto / serviço *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="input pr-9"
                        placeholder="Buscar nos cadastrados ou digitar manualmente..."
                        {...register('service_name')}
                        onFocus={() => setShowProductPicker(true)}
                        onChange={e => {
                          setProductSearch(e.target.value)
                          register('service_name').onChange(e)
                        }}
                        autoComplete="off"
                      />
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />

                      {showProductPicker && (
                        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-modal max-h-48 overflow-y-auto">
                          {(productsList ?? [])
                            .filter((p: Record<string, unknown>) =>
                              productSearch === '' ||
                              (p.name as string).toLowerCase().includes(productSearch.toLowerCase())
                            )
                            .slice(0, 8)
                            .map((p: Record<string, unknown>) => (
                              <button
                                key={p.id as string}
                                type="button"
                                className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary/10 flex items-center justify-between gap-3 border-b border-border dark:border-border-dark last:border-0 transition-colors"
                                onClick={() => {
                                  setValue('service_name', p.name as string)
                                  setValue('product_id', p.id as string)
                                  setValue('subtotal', Number(p.final_price) || 0)
                                  setValue('total', Number(p.final_price) || 0)
                                  if (p.description) setValue('description', p.description as string)
                                  setProductSearch(p.name as string)
                                  setShowProductPicker(false)
                                }}
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
                          <div className="px-3 py-2 bg-primary-50/50 dark:bg-primary/5">
                            <p className="text-[10px] text-text-muted dark:text-stone-500">💡 Ou continue digitando para inserir manualmente</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.service_name && <p className="mt-1 text-xs text-error">{errors.service_name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Descrição do pedido</label>
                    <textarea rows={2} className="input resize-none" placeholder="Detalhes, especificações, cores..." {...register('description')} />
                  </div>
                </section>

                <div className="h-px bg-border dark:bg-border-dark" />

                {/* ── S3: Valores ── */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-stone-400 flex items-center gap-2">
                    <DollarSign size={12} /> Valores
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Subtotal (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" placeholder="0,00" {...register('subtotal')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">Desconto (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" placeholder="0,00" {...register('discount')} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                    <span className="text-sm font-medium text-text-secondary dark:text-stone-400">Total final</span>
                    <span className="text-xl font-bold text-primary">
                      {fmtGlobal(Math.max(0, Number(watch('subtotal') || 0) - Number(watch('discount') || 0)))}
                    </span>
                  </div>
                  <input type="hidden" {...register('total')} />
                </section>

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
                          onClick={() => { setEditingPaymentId(null); resetPayment({ fill_type: 'amount', amount: 0, percentage: 0, payment_date: new Date().toISOString().split('T')[0], payment_method: '', observation: '' }); setShowPaymentModal(true) }}
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
                                          setEditingPaymentId(p.id)
                                          resetPayment({
                                            fill_type: 'amount',
                                            amount: Number(p.amount),
                                            percentage: Math.round(pct * 100) / 100,
                                            payment_date: p.payment_date,
                                            payment_method: p.payment_method ?? '',
                                            observation: p.observation ?? '',
                                          })
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

                {/* ── Anexos (estrutura futura) ── */}
                <section className="rounded-xl border border-dashed border-border dark:border-border-dark p-4 text-center">
                  <FileText size={20} className="text-text-muted mx-auto mb-2" />
                  <p className="text-xs font-medium text-text-secondary dark:text-stone-400">Anexos</p>
                  <p className="text-[10px] text-text-muted dark:text-stone-500 mt-0.5">Upload de arte, PDF e imagens — em breve</p>
                </section>

              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark bg-white dark:bg-surface-dark sticky bottom-0">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); reset(); setEditingId(null); setEditingPaymentId(null) }}
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
          MODAL REGISTRAR RECEBIMENTO
      ══════════════════════════════════ */}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setShowPaymentModal(false); setEditingPaymentId(null); resetPayment() }}
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
                onClick={() => { setShowPaymentModal(false); setEditingPaymentId(null); resetPayment() }}
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
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={modalMaxAmount}
                    className="input text-lg font-semibold"
                    placeholder="0,00"
                    {...registerPayment('amount')}
                  />
                  {paymentErrors.amount && <p className="mt-1 text-xs text-error">{paymentErrors.amount.message}</p>}
                  <p className="mt-1 text-[11px] text-text-muted">
                    Equivalente a {Number(paymentPercentageField || 0).toFixed(2).replace('.', ',')}% do pedido
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Percentual recebido (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={orderTotal > 0 ? Math.round((modalMaxAmount / orderTotal) * 10000) / 100 : 0}
                    className="input text-lg font-semibold"
                    placeholder="0,00"
                    {...registerPayment('percentage')}
                  />
                  {paymentErrors.amount && <p className="mt-1 text-xs text-error">{paymentErrors.amount.message}</p>}
                  <p className="mt-1 text-[11px] text-text-muted">
                    Equivalente a {fmtGlobal(Number(paymentAmountField || 0))}
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
                  onClick={() => { setShowPaymentModal(false); setEditingPaymentId(null); resetPayment() }}
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
