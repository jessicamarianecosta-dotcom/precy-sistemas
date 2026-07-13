-- ============================================================
-- PRECY+ — Migration 053: variant_id em order_items / budget_items
-- ============================================================
-- Mesmo padrão já usado para product_id (ON DELETE SET NULL, migration 020)
-- e para os campos denormalizados de order_items (migration 042): o pedido
-- ou orçamento deve sobreviver à exclusão/edição da variante ou do produto.
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id    UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS variant_sku   TEXT,
  ADD COLUMN IF NOT EXISTS variant_photo TEXT;

CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);

ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS variant_id    UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_label TEXT;

CREATE INDEX IF NOT EXISTS idx_budget_items_variant_id ON public.budget_items(variant_id);
