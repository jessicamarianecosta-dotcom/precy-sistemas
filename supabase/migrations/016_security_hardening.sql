-- ============================================================
-- PRECY+ — Migration 016: Hardening de Segurança Multi-Tenant
-- Execute no SQL Editor: app.supabase.com
-- ============================================================

-- ── 1. Função helper: retorna company_id do usuário autenticado ──
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── 2. Ativar RLS em TODAS as tabelas ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies','orders','products','inventory','customers',
    'budgets','budget_items','product_materials',
    'calendar_tasks','financial_transactions','fixed_costs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── 3. Limpar políticas antigas ──
DO $$
DECLARE t TEXT; r RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies','orders','products','inventory','customers',
    'budgets','budget_items','product_materials',
    'calendar_tasks','financial_transactions','fixed_costs'
  ]
  LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ── 4. Policies: companies ──
CREATE POLICY "companies_own" ON public.companies FOR ALL
  USING   (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 5. Policies: tabelas com company_id ──
CREATE POLICY "orders_tenant"               ON public.orders                FOR ALL USING (company_id = auth.user_company_id()) WITH CHECK (company_id = auth.user_company_id());
CREATE POLICY "products_tenant"             ON public.products              FOR ALL USING (company_id = auth.user_company_id()) WITH CHECK (company_id = auth.user_company_id());
CREATE POLICY "inventory_tenant"            ON public.inventory             FOR ALL USING (company_id = auth.user_company_id()) WITH CHECK (company_id = auth.user_company_id());
CREATE POLICY "customers_tenant"            ON public.customers             FOR ALL USING (company_id = auth.user_company_id()) WITH CHECK (company_id = auth.user_company_id());
CREATE POLICY "budgets_tenant"              ON public.budgets               FOR ALL USING (company_id = auth.user_company_id()) WITH CHECK (company_id = auth.user_company_id());
CREATE POLICY "calendar_tasks_tenant"       ON public.calendar_tasks        FOR ALL USING (company_id = auth.user_company_id()) WITH CHECK (company_id = auth.user_company_id());
CREATE POLICY "financial_transactions_tenant" ON public.financial_transactions FOR ALL USING (company_id = auth.user_company_id()) WITH CHECK (company_id = auth.user_company_id());
CREATE POLICY "fixed_costs_tenant"          ON public.fixed_costs           FOR ALL USING (company_id = auth.user_company_id()) WITH CHECK (company_id = auth.user_company_id());

-- ── 6. Policies: budget_items (via budget) ──
CREATE POLICY "budget_items_tenant" ON public.budget_items FOR ALL
  USING   (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND b.company_id = auth.user_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND b.company_id = auth.user_company_id()));

-- ── 7. product_materials ──
CREATE POLICY "product_materials_tenant" ON public.product_materials FOR ALL
  USING   (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

-- ── 8. Tabelas que ainda não existem (criar com IF NOT EXISTS) ──
CREATE TABLE IF NOT EXISTS public.user_consents (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL,
  version     TEXT NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_consents_own" ON public.user_consents;
CREATE POLICY "user_consents_own" ON public.user_consents FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 9. Colunas adicionais pendentes ──
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS payment_method  TEXT;
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS pay_condition   TEXT;
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS installments    INT DEFAULT 1;
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS signal_amount   NUMERIC DEFAULT 0;
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS delivery_type   TEXT;
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS delivery_fee    NUMERIC DEFAULT 0;
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS delivery_addr   TEXT;
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS delivery_days   TEXT;
ALTER TABLE public.budgets       ADD COLUMN IF NOT EXISTS production_days TEXT;

ALTER TABLE public.budget_items  ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE public.budget_items  ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.budget_items  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.customers     ADD COLUMN IF NOT EXISTS city     TEXT;
ALTER TABLE public.customers     ADD COLUMN IF NOT EXISTS state    TEXT;
ALTER TABLE public.customers     ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;
ALTER TABLE public.customers     ADD COLUMN IF NOT EXISTS address  TEXT;

ALTER TABLE public.companies     ADD COLUMN IF NOT EXISTS primary_color    TEXT DEFAULT '#8B6C4F';
ALTER TABLE public.companies     ADD COLUMN IF NOT EXISTS secondary_color  TEXT DEFAULT '#2C2018';
ALTER TABLE public.companies     ADD COLUMN IF NOT EXISTS logo_url         TEXT;
ALTER TABLE public.companies     ADD COLUMN IF NOT EXISTS prolabore        NUMERIC DEFAULT 0;
ALTER TABLE public.companies     ADD COLUMN IF NOT EXISTS work_hours_per_month INTEGER DEFAULT 160;

ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS product_type    TEXT DEFAULT 'produced';
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS extra_cost      NUMERIC DEFAULT 0;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS labor_cost      NUMERIC DEFAULT 0;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS total_cost      NUMERIC DEFAULT 0;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS purchase_cost   NUMERIC DEFAULT 0;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS width           NUMERIC;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS height          NUMERIC;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS measurement_unit TEXT;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS area            NUMERIC;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS price_per_m2    NUMERIC DEFAULT 0;
ALTER TABLE public.products      ADD COLUMN IF NOT EXISTS finishing_cost  NUMERIC DEFAULT 0;

ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS service_name    TEXT;
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS priority        TEXT DEFAULT 'normal';
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS order_date      DATE;
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS payment_method  TEXT;
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS signal_amount   NUMERIC DEFAULT 0;

ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'received';
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS client_name  TEXT;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS notes        TEXT;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

-- ── 10. calendar_tasks (garantir existência) ──
CREATE TABLE IF NOT EXISTS public.calendar_tasks (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL, description TEXT, date DATE NOT NULL, time TIME,
  priority        TEXT DEFAULT 'normal', category TEXT DEFAULT 'task',
  status          TEXT DEFAULT 'pending', notes TEXT,
  linked_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── 11. financial_transactions (garantir existência) ──
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id  UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  category    TEXT NOT NULL DEFAULT 'outros',
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT, date DATE NOT NULL DEFAULT CURRENT_DATE,
  status      TEXT DEFAULT 'received', client_name TEXT,
  order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  notes TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. Índices de performance ──
CREATE INDEX IF NOT EXISTS idx_orders_company     ON public.orders(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company   ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_company  ON public.inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company  ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_budgets_company    ON public.budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_company     ON public.financial_transactions(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_company   ON public.calendar_tasks(company_id, date);

-- ── 13. Storage: bucket company-assets ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-assets','company-assets',true,2097152,
  ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public=true, file_size_limit=2097152;

DROP POLICY IF EXISTS "ca_select" ON storage.objects;
DROP POLICY IF EXISTS "ca_insert" ON storage.objects;
DROP POLICY IF EXISTS "ca_update" ON storage.objects;
DROP POLICY IF EXISTS "ca_delete" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_delete" ON storage.objects;

CREATE POLICY "ca_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='company-assets');
CREATE POLICY "ca_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='company-assets');
CREATE POLICY "ca_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='company-assets');
CREATE POLICY "ca_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='company-assets');
