-- ============================================================
-- PRECY+ — Migration 008: Campos de produto por metro
-- Execute no SQL Editor: app.supabase.com
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS width            NUMERIC,
  ADD COLUMN IF NOT EXISTS height           NUMERIC,
  ADD COLUMN IF NOT EXISTS measurement_unit TEXT,
  ADD COLUMN IF NOT EXISTS area             NUMERIC,
  ADD COLUMN IF NOT EXISTS price_per_m2     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_cm2    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finishing_cost   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS area_total_cost  NUMERIC DEFAULT 0;
