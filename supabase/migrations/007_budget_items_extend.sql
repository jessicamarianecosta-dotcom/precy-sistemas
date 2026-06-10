-- ============================================================
-- PRECY+ — Migration 007: budget_items e budgets extensão
-- Execute no SQL Editor: app.supabase.com
-- ============================================================
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();
