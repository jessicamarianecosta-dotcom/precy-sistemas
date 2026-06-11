-- Migration 014: Adicionar prolabore e work_hours_per_month na tabela companies
-- Execute no SQL Editor do Supabase

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS prolabore          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_hours_per_month INTEGER DEFAULT 160,
  ADD COLUMN IF NOT EXISTS weeks_per_month    NUMERIC DEFAULT 4.33;
