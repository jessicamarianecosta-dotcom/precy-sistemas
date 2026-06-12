-- Execute no SQL Editor do Supabase
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_plan            TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_end               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end      TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_stripe_customer
  ON public.companies(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
