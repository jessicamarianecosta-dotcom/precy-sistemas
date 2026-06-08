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
  status: 'pending' | 'production' | 'ready' | 'delivered' | 'cancelled';
  total: number;
  payment_status: 'pending' | 'paid' | 'overdue';
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
  items: BudgetItem[];
  total: number;
  valid_until: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'converted';
  created_at: string;
  updated_at: string;
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
