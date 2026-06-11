-- ============================================================
-- PRECY+ — Migration 015: RLS completo multi-tenant
-- Execute no SQL Editor do Supabase (app.supabase.com)
-- ============================================================

CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid() LIMIT 1;
$$;

-- RLS em todas as tabelas
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Recriar policies com isolamento por company
DROP POLICY IF EXISTS "orders_tenant" ON public.orders;
CREATE POLICY "orders_tenant" ON public.orders FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "products_tenant" ON public.products;
CREATE POLICY "products_tenant" ON public.products FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "inventory_tenant" ON public.inventory;
CREATE POLICY "inventory_tenant" ON public.inventory FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "customers_tenant" ON public.customers;
CREATE POLICY "customers_tenant" ON public.customers FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "budgets_tenant" ON public.budgets;
CREATE POLICY "budgets_tenant" ON public.budgets FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "budget_items_tenant" ON public.budget_items;
CREATE POLICY "budget_items_tenant" ON public.budget_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND b.company_id = auth.user_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND b.company_id = auth.user_company_id()));

DROP POLICY IF EXISTS "calendar_tasks_tenant" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks_tenant" ON public.calendar_tasks FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "financial_transactions_tenant" ON public.financial_transactions;
CREATE POLICY "financial_transactions_tenant" ON public.financial_transactions FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "fixed_costs_tenant" ON public.fixed_costs;
CREATE POLICY "fixed_costs_tenant" ON public.fixed_costs FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

DROP POLICY IF EXISTS "companies_own" ON public.companies;
CREATE POLICY "companies_own" ON public.companies FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Tabela de consentimentos LGPD
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

-- Storage policies: company-assets privado por autenticação
DROP POLICY IF EXISTS "company_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_delete" ON storage.objects;
CREATE POLICY "company_assets_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'company-assets');
CREATE POLICY "company_assets_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "company_assets_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-assets');
CREATE POLICY "company_assets_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-assets');
