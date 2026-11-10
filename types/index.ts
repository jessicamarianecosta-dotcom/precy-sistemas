// User & Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  cnpj?: string;
  fixed_costs: number;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

// Product Types
export interface Product {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  base_cost: number;
  markup: number;
  final_price: number;
  created_at: string;
  updated_at: string;
}

// Inventory Types
export interface Inventory {
  id: string;
  company_id: string;
  product_id: string;
  quantity: number;
  minimum_quantity: number;
  supplier?: string;
  status: 'healthy' | 'attention' | 'critical';
  created_at: string;
  updated_at: string;
}

// Order Types
export interface Order {
  id: string;
  company_id: string;
  customer_id: string;
  order_number?: string;
  service_name?: string;
  status: 'pending' | 'production' | 'ready' | 'delivered' | 'cancelled';
  total: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  payment_method?: string;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Payment History Types (recebimentos do pedido)
export interface PaymentHistoryEntry {
  id: string;
  order_id: string;
  customer_id?: string | null;
  company_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string | null;
  observation?: string | null;
  percentage?: number | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// Customer Types
export interface Customer {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  cpf_cnpj?: string;
  created_at: string;
  updated_at: string;
}

// Budget Types
export interface Budget {
  id: string;
  company_id: string;
  customer_id: string;
  budget_number: string;
  items: BudgetItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'converted';
  converted_to_order_id: string | null;
  quote_id?: string | null;
  created_at: string;
  updated_at: string;
  /* Pagamento / entrega */
  payment_method: string | null;
  pay_condition: 'avista' | 'parcelado' | 'entrada' | 'prazo' | null;
  installments: number | null;
  signal_amount: number | null;
  delivery_type: string | null;
  delivery_fee: number | null;
  delivery_addr: string | null;
  delivery_days: string | null;
  production_days: string | null;
  prazo_type: 'dias' | 'data' | null;
  prazo_dias: number | null;
  prazo_due_date: string | null;
  /* PIX (snapshot congelado no momento da emissão) */
  pix_type: string | null;
  pix_key: string | null;
  pix_label: string | null;
  pix_txid: string | null;
  payment_status: 'pending' | 'paid' | 'partial';
  /* Orçamento digital — link público */
  public_token: string;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  product_id: string | null;
  name?: string | null;
  description?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount?: number | null;
  width?: number | null;
  height?: number | null;
  area?: number | null;
  measurement_unit?: string | null;
  finishings?: string[] | null;
  finishing_type?: string | null;
  technical_notes?: string | null;
  pricing_mode?: 'fixed' | 'square_meter' | null;
  price_per_m2?: number | null;
  variant_id?: string | null;
  variant_label?: string | null;
  unit_cost?: number | null;
}

// Financial Types
export interface Transaction {
  id: string;
  company_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  date: string;
  status?: string;
  client_name?: string;
  order_id?: string | null;
  payment_history_id?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Subscription Types
export interface Subscription {
  id: string;
  user_id: string;
  plan: 'basic' | 'pro';
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  stripe_subscription_id?: string;
  trial_ends_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  created_at: string;
  updated_at: string;
}

// Dashboard Types
export interface DashboardMetrics {
  revenue: number;
  profit: number;
  pending_orders: number;
  critical_inventory: number;
  timestamp: string;
}
