-- ============================================================
-- PRECY+ — Migration 004: Estender tabela orders
-- ============================================================
-- Execute no SQL Editor do painel Supabase:
-- https://app.supabase.com → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Remover constraints que limitam valores válidos
-- (precisamos aceitar 'partial' no payment_status e outros)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS valid_status,
  DROP CONSTRAINT IF EXISTS valid_payment;

-- Adicionar colunas faltantes
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_name     TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS priority         TEXT    DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS order_date       DATE,
  ADD COLUMN IF NOT EXISTS payment_method   TEXT,
  ADD COLUMN IF NOT EXISTS signal_amount    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_id       UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Recriar constraints com valores ampliados
ALTER TABLE public.orders
  ADD CONSTRAINT valid_status  CHECK (status IN ('pending','production','ready','delivered','cancelled')),
  ADD CONSTRAINT valid_payment CHECK (payment_status IN ('pending','partial','paid','overdue'));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_service_name ON public.orders(service_name);
CREATE INDEX IF NOT EXISTS idx_orders_product_id   ON public.orders(product_id);

