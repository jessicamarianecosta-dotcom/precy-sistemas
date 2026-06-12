-- Migration 018: Colunas para sistema SaaS completo
-- Execute no SQL Editor do Supabase

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS current_plan            TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_end               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_end        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usage_products          INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_orders_month      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_at          TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_stripe_customer
  ON public.companies(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Trial de 7 dias para empresas existentes sem status
UPDATE public.companies
SET subscription_status = 'trialing',
    trial_end = NOW() + INTERVAL '7 days'
WHERE subscription_status IS NULL OR subscription_status = '';
