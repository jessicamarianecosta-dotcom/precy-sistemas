-- Migration 012: Financeiro premium
-- Execute no SQL Editor do Supabase
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS client_name  TEXT,
  ADD COLUMN IF NOT EXISTS order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_id    UUID,
  ADD COLUMN IF NOT EXISTS installments INT  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_ft_company_date ON public.financial_transactions(company_id, date);
