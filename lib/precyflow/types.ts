export type PrecyFlowTheme = 'cat' | 'cores'
export type PrecyFlowAccent = 'rosa' | 'azul' | 'lilas' | 'preto' | 'verde' | 'marrom'
export type PrecyFlowOrderStatus = 'a_confirmar' | 'em_producao' | 'pronto' | 'entregue'
export type PrecyFlowBudgetStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado'
export type PrecyFlowTransactionType = 'entrada' | 'saida'
export type PrecyFlowTransactionStatus = 'pendente' | 'pago' | 'atrasado'
export type PrecyFlowTaskPriority = 'baixa' | 'media' | 'alta'
export type PrecyFlowTaskStatus = 'aberta' | 'concluida'

export interface PrecyFlowStore {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  contact_phone: string | null
  contact_email: string | null
  theme: PrecyFlowTheme
  theme_color: PrecyFlowAccent
  published: boolean
  created_at: string
  updated_at: string
}

export interface PrecyFlowSupplier {
  id: string
  store_id: string
  name: string
  contact: string | null
  category: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PrecyFlowMaterial {
  id: string
  store_id: string
  supplier_id: string | null
  name: string
  unit: string
  cost_per_unit: number
  quantity: number
  minimum_quantity: number
  created_at: string
  updated_at: string
}

export interface PrecyFlowProduct {
  id: string
  store_id: string
  name: string
  description: string | null
  category: string
  sku: string | null
  price: number
  stock_quantity: number
  minimum_quantity: number
  variations: Record<string, unknown> | null
  image_url: string | null
  is_active: boolean
  show_in_storefront: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface PrecyFlowCustomer {
  id: string
  store_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PrecyFlowOrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export interface PrecyFlowOrder {
  id: string
  store_id: string
  customer_id: string
  order_number: string
  status: PrecyFlowOrderStatus
  origin: 'manual' | 'vitrine'
  subtotal: number
  discount: number
  total: number
  notes: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  customer?: PrecyFlowCustomer
  items?: PrecyFlowOrderItem[]
}

export interface PrecyFlowBudgetItem {
  id: string
  budget_id: string
  product_id: string | null
  description: string
  image_url: string | null
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export interface PrecyFlowBudget {
  id: string
  store_id: string
  customer_id: string
  budget_number: string
  status: PrecyFlowBudgetStatus
  subtotal: number
  discount: number
  total: number
  notes: string | null
  conditions: string | null
  valid_until: string | null
  share_token: string
  converted_to_order_id: string | null
  created_at: string
  updated_at: string
  customer?: PrecyFlowCustomer
  items?: PrecyFlowBudgetItem[]
}

export interface PrecyFlowTransaction {
  id: string
  store_id: string
  order_id: string | null
  type: PrecyFlowTransactionType
  category: string
  description: string | null
  amount: number
  due_date: string | null
  payment_date: string | null
  payment_method: string | null
  status: PrecyFlowTransactionStatus
  created_at: string
  updated_at: string
}

export interface PrecyFlowAgendaEvent {
  id: string
  store_id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  customer_id: string | null
  order_id: string | null
  reminder: boolean
  completed: boolean
  created_at: string
  updated_at: string
}

export interface PrecyFlowTask {
  id: string
  store_id: string
  title: string
  due_date: string | null
  priority: PrecyFlowTaskPriority
  status: PrecyFlowTaskStatus
  order_id: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
}

export const ORDER_STATUS_LABELS: Record<PrecyFlowOrderStatus, string> = {
  a_confirmar: 'A confirmar',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
}

export const BUDGET_STATUS_LABELS: Record<PrecyFlowBudgetStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
}

export const TASK_PRIORITY_LABELS: Record<PrecyFlowTaskPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}
