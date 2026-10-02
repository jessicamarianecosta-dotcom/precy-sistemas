-- ============================================================
-- PRECY+ — Migration 082: Precificação por variação + vínculo em itens
-- ============================================================
-- 100% aditiva (só ADD COLUMN IF NOT EXISTS, tudo nullable): nenhum dado ou
-- comportamento existente muda. product_variants.price continua sendo o
-- preço de venda da combinação (NULL = usa o preço do produto, fallback).
-- As colunas novas guardam a composição do custo, com a MESMA fórmula do
-- produto: total_cost = material + mão de obra + extras;
-- price = total_cost × (1 + markup/100).
-- ============================================================

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS material_cost     NUMERIC,
  ADD COLUMN IF NOT EXISTS labor_cost        NUMERIC,
  ADD COLUMN IF NOT EXISTS extra_cost        NUMERIC,
  ADD COLUMN IF NOT EXISTS total_cost        NUMERIC,
  ADD COLUMN IF NOT EXISTS markup_percentage NUMERIC;

-- Itens de orçamento / pedido guardam a combinação escolhida e o custo
-- unitário (snapshot), para que o lucro sobreviva a edições futuras do
-- produto e à conversão orçamento → pedido.
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS variant_id    UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS unit_cost     NUMERIC;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id    UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS unit_cost     NUMERIC;

CREATE INDEX IF NOT EXISTS idx_budget_items_variant ON public.budget_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_variant  ON public.order_items(variant_id)  WHERE variant_id IS NOT NULL;
