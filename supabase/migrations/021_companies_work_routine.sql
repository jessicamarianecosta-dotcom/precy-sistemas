-- ============================================================
-- PRECY+ — Migration 021: Rotina de trabalho persistida
-- ============================================================
-- PROBLEMA:
--   days_per_week, hours_per_day, weeks_per_month e prolabore
--   viviam apenas no localStorage — sumiam ao trocar de
--   dispositivo, limpar cache ou usar mobile.
--
-- SOLUÇÃO:
--   Adicionar colunas na tabela companies para persistir
--   todos os valores da rotina de trabalho no Supabase.
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS days_per_week    NUMERIC DEFAULT 5   NOT NULL,
  ADD COLUMN IF NOT EXISTS hours_per_day   NUMERIC DEFAULT 8   NOT NULL,
  ADD COLUMN IF NOT EXISTS weeks_per_month NUMERIC DEFAULT 4.3 NOT NULL,
  ADD COLUMN IF NOT EXISTS prolabore       NUMERIC DEFAULT 0   NOT NULL;
