-- ============================================================
-- PRECY+ — Migration 011: Schema completo para orçamentos
-- Execute no SQL Editor: app.supabase.com
-- Esta migration ativa TODOS os campos do PDF e do wizard
-- ============================================================

-- 1. Tabela budgets: campos de pagamento e entrega
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS payment_method  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_type   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee    NUMERIC     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_addr   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_days   TEXT,
  ADD COLUMN IF NOT EXISTS production_days TEXT;

-- 2. Tabela budget_items: nome e descrição do item
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- 3. Tabela customers: localização e documento
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS city     TEXT,
  ADD COLUMN IF NOT EXISTS state    TEXT,
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS address  TEXT;

-- 4. Tabela companies: branding
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS primary_color   TEXT DEFAULT '#8B6C4F',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#2C2018',
  ADD COLUMN IF NOT EXISTS logo_url        TEXT;

-- 5. Tabela orders: campos extras (para Pedidos e integração)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_name   TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS priority       TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS order_date     DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS signal_amount  NUMERIC DEFAULT 0;

-- 6. Tabela products: campos de precificação por metro e tipo
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type     TEXT    DEFAULT 'produced',
  ADD COLUMN IF NOT EXISTS extra_cost       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_cost       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_cost    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS width            NUMERIC,
  ADD COLUMN IF NOT EXISTS height           NUMERIC,
  ADD COLUMN IF NOT EXISTS measurement_unit TEXT,
  ADD COLUMN IF NOT EXISTS area             NUMERIC,
  ADD COLUMN IF NOT EXISTS price_per_m2     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_cm2    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finishing_cost   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS area_total_cost  NUMERIC DEFAULT 0;

-- 7. Tabela calendar_tasks (para a Agenda)
CREATE TABLE IF NOT EXISTS public.calendar_tasks (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  date            DATE NOT NULL,
  time            TIME,
  priority        TEXT DEFAULT 'normal',
  category        TEXT DEFAULT 'task',
  status          TEXT DEFAULT 'pending',
  notes           TEXT,
  linked_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_tasks' AND policyname = 'Users can manage own calendar tasks'
  ) THEN
    EXECUTE 'ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY';
    EXECUTE '
      CREATE POLICY "Users can manage own calendar tasks"
      ON public.calendar_tasks FOR ALL
      USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid()))
    ';
  END IF;
END $$;

-- Storage: bucket company-assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-assets', 'company-assets', true, 2097152,
  ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "company_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_delete" ON storage.objects;

CREATE POLICY "company_assets_select" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "company_assets_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "company_assets_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-assets');
CREATE POLICY "company_assets_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-assets');
