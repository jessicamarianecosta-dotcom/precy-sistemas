-- ============================================================
-- PRECY+ — Migration 003: Estender tabela products
-- e criar tabela product_materials
-- ============================================================
-- Execute no SQL Editor do painel Supabase:
-- https://app.supabase.com → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ── 1. Adicionar colunas faltantes em products ──────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type    TEXT    DEFAULT 'produced',
  ADD COLUMN IF NOT EXISTS extra_cost      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_cost      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_cost   NUMERIC DEFAULT 0;

-- ── 2. Criar tabela product_materials ───────────────────────
CREATE TABLE IF NOT EXISTS public.product_materials (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id     UUID REFERENCES public.companies(id)  ON DELETE CASCADE NOT NULL,
  product_id     UUID REFERENCES public.products(id)   ON DELETE CASCADE NOT NULL,
  inventory_id   UUID REFERENCES public.inventory(id)  ON DELETE SET NULL,
  material_name  TEXT NOT NULL,
  quantity       NUMERIC DEFAULT 1 NOT NULL,
  unit           TEXT DEFAULT 'un' NOT NULL,
  unit_cost      NUMERIC DEFAULT 0 NOT NULL,
  subtotal       NUMERIC DEFAULT 0 NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own product_materials"
  ON public.product_materials FOR ALL
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

-- ── 3. Índices ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_product_materials_product_id
  ON public.product_materials(product_id);

CREATE INDEX IF NOT EXISTS idx_product_materials_company_id
  ON public.product_materials(company_id);

