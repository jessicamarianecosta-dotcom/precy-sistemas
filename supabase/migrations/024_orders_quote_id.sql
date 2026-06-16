-- ============================================================
-- PRECY+ — Migration 024: Vínculo Orçamento → Pedido
-- ============================================================
-- budgets.converted_to_order_id já existe (001_schema_inicial)
-- Adiciona orders.quote_id para vínculo bidirecional.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON public.orders(quote_id);
