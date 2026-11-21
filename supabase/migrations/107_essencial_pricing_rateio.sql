-- Migration 107: Rateio de custos indiretos da calculadora de Precificação do
-- plano Essencial. work_hours_per_month já existe (migration 014) e é
-- reaproveitado para o modo "por horas produtivas"; aqui só falta o modo de
-- rateio escolhido e a estimativa de vendas mensais para o modo alternativo.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS essencial_rateio_mode TEXT NOT NULL DEFAULT 'hours'
    CHECK (essencial_rateio_mode IN ('hours', 'sales_qty')),
  ADD COLUMN IF NOT EXISTS estimated_monthly_sales INTEGER NOT NULL DEFAULT 0;
