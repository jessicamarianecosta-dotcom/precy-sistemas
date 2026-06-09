-- ============================================================
-- PRECY+ — Migration 002: Corrigir políticas RLS e permissões
-- ============================================================
-- Execute este arquivo no SQL Editor do painel Supabase:
-- https://app.supabase.com → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ── profiles: adicionar INSERT policy ──────────────────────
-- O trigger handle_new_user cria o profile (SECURITY DEFINER),
-- mas adicionar a policy garante consistência.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── companies: políticas explícitas para cada operação ──────
DROP POLICY IF EXISTS "Users can manage own company" ON public.companies;
DROP POLICY IF EXISTS "Users can select own company" ON public.companies;
DROP POLICY IF EXISTS "Users can insert own company" ON public.companies;
DROP POLICY IF EXISTS "Users can update own company" ON public.companies;
DROP POLICY IF EXISTS "Users can delete own company" ON public.companies;

CREATE POLICY "Users can select own company"
  ON public.companies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company"
  ON public.companies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own company"
  ON public.companies FOR DELETE
  USING (auth.uid() = user_id);

-- ── fixed_costs: políticas explícitas ──────────────────────
DROP POLICY IF EXISTS "Users can manage own fixed_costs" ON public.fixed_costs;

CREATE POLICY "Users can manage own fixed_costs"
  ON public.fixed_costs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

-- ── inventory: políticas explícitas ────────────────────────
DROP POLICY IF EXISTS "Users can manage own inventory" ON public.inventory;

CREATE POLICY "Users can manage own inventory"
  ON public.inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

-- ── products: políticas explícitas ─────────────────────────
DROP POLICY IF EXISTS "Users can manage own products" ON public.products;

CREATE POLICY "Users can manage own products"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

-- ── customers: políticas explícitas ────────────────────────
DROP POLICY IF EXISTS "Users can manage own customers" ON public.customers;

CREATE POLICY "Users can manage own customers"
  ON public.customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

-- ── orders: políticas explícitas ───────────────────────────
DROP POLICY IF EXISTS "Users can manage own orders" ON public.orders;

CREATE POLICY "Users can manage own orders"
  ON public.orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

-- ── order_items: políticas explícitas ──────────────────────
DROP POLICY IF EXISTS "Users can manage own order_items" ON public.order_items;

CREATE POLICY "Users can manage own order_items"
  ON public.order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.companies c ON c.id = o.company_id
      WHERE o.id = order_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.companies c ON c.id = o.company_id
      WHERE o.id = order_id AND c.user_id = auth.uid()
    )
  );

-- ── budgets: políticas explícitas ──────────────────────────
DROP POLICY IF EXISTS "Users can manage own budgets" ON public.budgets;

CREATE POLICY "Users can manage own budgets"
  ON public.budgets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

-- ── budget_items: políticas explícitas ─────────────────────
DROP POLICY IF EXISTS "Users can manage own budget_items" ON public.budget_items;

CREATE POLICY "Users can manage own budget_items"
  ON public.budget_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      JOIN public.companies c ON c.id = b.company_id
      WHERE b.id = budget_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budgets b
      JOIN public.companies c ON c.id = b.company_id
      WHERE b.id = budget_id AND c.user_id = auth.uid()
    )
  );

-- ── transactions: políticas explícitas ─────────────────────
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;

CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

-- ── subscriptions: garantir que usuário pode ler ──────────
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can manage own subscription" ON public.subscriptions;

CREATE POLICY "Users can manage own subscription"
  ON public.subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Verificar RLS ativo em todas as tabelas ────────────────
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

