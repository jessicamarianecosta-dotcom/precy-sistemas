export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          cnpj: string | null
          logo_url: string | null
          work_hours_per_month: number
          fixed_costs: number
          currency: string
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          cnpj?: string | null
          logo_url?: string | null
          work_hours_per_month?: number
          fixed_costs?: number
          currency?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          cnpj?: string | null
          logo_url?: string | null
          work_hours_per_month?: number
          fixed_costs?: number
          currency?: string
          timezone?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          category: string
          unit: string
          production_time_hours: number
          material_cost: number
          markup_percentage: number
          final_price: number
          is_active: boolean
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          category?: string
          unit?: string
          production_time_hours?: number
          material_cost?: number
          markup_percentage?: number
          final_price?: number
          is_active?: boolean
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          category?: string
          unit?: string
          production_time_hours?: number
          material_cost?: number
          markup_percentage?: number
          final_price?: number
          is_active?: boolean
          image_url?: string | null
          updated_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          company_id: string
          name: string
          category: string
          unit: string
          quantity: number
          minimum_quantity: number
          cost_per_unit: number
          supplier: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          category?: string
          unit?: string
          quantity?: number
          minimum_quantity?: number
          cost_per_unit?: number
          supplier?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          category?: string
          unit?: string
          quantity?: number
          minimum_quantity?: number
          cost_per_unit?: number
          supplier?: string | null
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          company_id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          cpf_cnpj: string | null
          notes: string | null
          total_purchases: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          cpf_cnpj?: string | null
          notes?: string | null
          total_purchases?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          cpf_cnpj?: string | null
          notes?: string | null
          total_purchases?: number
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          order_number: string
          status: string
          payment_status: string
          subtotal: number
          discount: number
          total: number
          notes: string | null
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          order_number?: string
          status?: string
          payment_status?: string
          subtotal?: number
          discount?: number
          total?: number
          notes?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          status?: string
          payment_status?: string
          subtotal?: number
          discount?: number
          total?: number
          notes?: string | null
          due_date?: string | null
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
        }
        Update: {
          quantity?: number
          unit_price?: number
          subtotal?: number
        }
      }
      feedbacks: {
        Row: {
          id: string
          company_id: string
          user_id: string | null
          type: string
          subject: string
          message: string
          priority: string
          allow_contact: boolean
          attachment_url: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id?: string | null
          type: string
          subject: string
          message: string
          priority?: string
          allow_contact?: boolean
          attachment_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: string
          subject?: string
          message?: string
          priority?: string
          allow_contact?: boolean
          attachment_url?: string | null
          status?: string
          updated_at?: string
        }
      }
      budgets: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          budget_number: string
          status: string
          subtotal: number
          discount: number
          total: number
          notes: string | null
          valid_until: string | null
          converted_to_order_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          budget_number?: string
          status?: string
          subtotal?: number
          discount?: number
          total?: number
          notes?: string | null
          valid_until?: string | null
          converted_to_order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          status?: string
          subtotal?: number
          discount?: number
          total?: number
          notes?: string | null
          valid_until?: string | null
          converted_to_order_id?: string | null
          updated_at?: string
        }
      }
      budget_items: {
        Row: {
          id: string
          budget_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
        }
        Update: {
          quantity?: number
          unit_price?: number
          subtotal?: number
        }
      }
      transactions: {
        Row: {
          id: string
          company_id: string
          order_id: string | null
          type: string
          category: string
          amount: number
          description: string | null
          date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          order_id?: string | null
          type: string
          category?: string
          amount: number
          description?: string | null
          date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: string
          category?: string
          amount?: number
          description?: string | null
          date?: string
          updated_at?: string
        }
      }
      fixed_costs: {
        Row: {
          id: string
          company_id: string
          name: string
          amount: number
          category: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          amount: number
          category?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          amount?: number
          category?: string
          is_active?: boolean
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: string
          status: string
          stripe_subscription_id: string | null
          stripe_customer_id: string | null
          trial_ends_at: string | null
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
