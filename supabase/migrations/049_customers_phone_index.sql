-- ============================================================
-- PRECY+ — Migration 049: índice para dedup de cliente por telefone
-- ============================================================
-- Suporta a busca introduzida pelo checkout/orçamento do Catálogo Online
-- (.eq('company_id', X).eq('phone', Y)) sem exigir sequential scan.
CREATE INDEX IF NOT EXISTS idx_customers_company_phone ON public.customers(company_id, phone);
