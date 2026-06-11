-- ============================================================
-- PRECY+ — Migration 016 v2: RLS Multi-Tenant Corrigido
-- DIFERENÇA v1→v2: função em public.get_user_company_id()
-- em vez de auth.user_company_id() (schema auth é restrito)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Função helper no schema public
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Criar tabelas se não existirem
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL DEFAULT 'outros',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT, date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'received', client_name TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.calendar_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL, description TEXT, date DATE NOT NULL, time TIME,
  priority TEXT DEFAULT 'normal', category TEXT DEFAULT 'task',
  status TEXT DEFAULT 'pending', notes TEXT,
  linked_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Habilitar RLS em todas as tabelas
ALTER TABLE public.companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs            ENABLE ROW LEVEL SECURITY;

-- 4. Remover policies antigas
DROP POLICY IF EXISTS "companies_own"                              ON public.companies;
DROP POLICY IF EXISTS "orders_tenant"                              ON public.orders;
DROP POLICY IF EXISTS "products_tenant"                            ON public.products;
DROP POLICY IF EXISTS "inventory_tenant"                           ON public.inventory;
DROP POLICY IF EXISTS "customers_tenant"                           ON public.customers;
DROP POLICY IF EXISTS "budgets_tenant"                             ON public.budgets;
DROP POLICY IF EXISTS "budget_items_tenant"                        ON public.budget_items;
DROP POLICY IF EXISTS "calendar_tasks_tenant"                      ON public.calendar_tasks;
DROP POLICY IF EXISTS "financial_transactions_tenant"              ON public.financial_transactions;
DROP POLICY IF EXISTS "fixed_costs_tenant"                         ON public.fixed_costs;
DROP POLICY IF EXISTS "Users can manage own calendar tasks"        ON public.calendar_tasks;
DROP POLICY IF EXISTS "Users can manage own financial transactions" ON public.financial_transactions;

-- 5. Criar policies corretas (usando public.get_user_company_id)
CREATE POLICY "companies_own" ON public.companies FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_tenant"    ON public.orders    FOR ALL USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "products_tenant"  ON public.products  FOR ALL USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "inventory_tenant" ON public.inventory FOR ALL USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "customers_tenant" ON public.customers FOR ALL USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "budgets_tenant"   ON public.budgets   FOR ALL USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "budget_items_tenant" ON public.budget_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND b.company_id = public.get_user_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND b.company_id = public.get_user_company_id()));

CREATE POLICY "calendar_tasks_tenant"          ON public.calendar_tasks         FOR ALL USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "financial_transactions_tenant"  ON public.financial_transactions  FOR ALL USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "fixed_costs_tenant"             ON public.fixed_costs             FOR ALL USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

-- 6. Colunas pendentes (todas com IF NOT EXISTS)
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(), ADD COLUMN IF NOT EXISTS payment_method TEXT, ADD COLUMN IF NOT EXISTS pay_condition TEXT, ADD COLUMN IF NOT EXISTS installments INT DEFAULT 1, ADD COLUMN IF NOT EXISTS signal_amount NUMERIC DEFAULT 0, ADD COLUMN IF NOT EXISTS delivery_type TEXT, ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0, ADD COLUMN IF NOT EXISTS delivery_addr TEXT, ADD COLUMN IF NOT EXISTS delivery_days TEXT, ADD COLUMN IF NOT EXISTS production_days TEXT;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS name TEXT, ADD COLUMN IF NOT EXISTS description TEXT, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city TEXT, ADD COLUMN IF NOT EXISTS state TEXT, ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT, ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#8B6C4F', ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#2C2018', ADD COLUMN IF NOT EXISTS logo_url TEXT, ADD COLUMN IF NOT EXISTS prolabore NUMERIC DEFAULT 0, ADD COLUMN IF NOT EXISTS work_hours_per_month INTEGER DEFAULT 160;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_name TEXT, ADD COLUMN IF NOT EXISTS description TEXT, ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal', ADD COLUMN IF NOT EXISTS order_date DATE, ADD COLUMN IF NOT EXISTS payment_method TEXT, ADD COLUMN IF NOT EXISTS signal_amount NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'produced', ADD COLUMN IF NOT EXISTS extra_cost NUMERIC DEFAULT 0, ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0, ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0, ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC DEFAULT 0, ADD COLUMN IF NOT EXISTS width NUMERIC, ADD COLUMN IF NOT EXISTS height NUMERIC, ADD COLUMN IF NOT EXISTS measurement_unit TEXT, ADD COLUMN IF NOT EXISTS area NUMERIC, ADD COLUMN IF NOT EXISTS price_per_m2 NUMERIC DEFAULT 0, ADD COLUMN IF NOT EXISTS finishing_cost NUMERIC DEFAULT 0;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received', ADD COLUMN IF NOT EXISTS client_name TEXT, ADD COLUMN IF NOT EXISTS notes TEXT, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Índices de performance
CREATE INDEX IF NOT EXISTS idx_orders_company    ON public.orders(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company  ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_budgets_company   ON public.budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_company    ON public.financial_transactions(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_company  ON public.calendar_tasks(company_id, date);

-- 8. Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-assets','company-assets',true,2097152,ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public=true;

DROP POLICY IF EXISTS "ca_select" ON storage.objects;
DROP POLICY IF EXISTS "ca_insert" ON storage.objects;
DROP POLICY IF EXISTS "ca_update" ON storage.objects;
DROP POLICY IF EXISTS "ca_delete" ON storage.objects;
CREATE POLICY "ca_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='company-assets');
CREATE POLICY "ca_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='company-assets');
CREATE POLICY "ca_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='company-assets');
CREATE POLICY "ca_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='company-assets');
