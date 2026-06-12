-- =============================================================
-- PRECY+ — Migration 019: Setup Final Stripe + Assinaturas
-- Execute no SQL Editor: app.supabase.com → SQL Editor
-- =============================================================

-- Colunas de assinatura na tabela companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS current_plan            TEXT    DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT    DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_end               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_end        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_at              TIMESTAMPTZ;

-- Índice único para evitar duplicação de customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_stripe_customer
  ON public.companies(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Índice de performance
CREATE INDEX IF NOT EXISTS idx_companies_status
  ON public.companies(subscription_status);

-- Trial de 7 dias para empresas existentes sem status de assinatura
UPDATE public.companies
SET
  subscription_status = 'trialing',
  trial_end = NOW() + INTERVAL '7 days'
WHERE
  (subscription_status IS NULL OR subscription_status = '')
  AND stripe_subscription_id IS NULL;

-- Confirmar resultado
SELECT
  COUNT(*)                                          AS total_companies,
  COUNT(*) FILTER (WHERE subscription_status = 'trialing')  AS trialing,
  COUNT(*) FILTER (WHERE subscription_status = 'active')    AS active,
  COUNT(*) FILTER (WHERE subscription_status = 'canceled')  AS canceled,
  COUNT(*) FILTER (WHERE stripe_customer_id IS NOT NULL)     AS with_stripe_customer
FROM public.companies;
