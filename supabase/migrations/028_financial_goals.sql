-- ============================================================
-- PRECY+ — Migration 028: Metas Financeiras (Financeiro Avançado)
-- ============================================================
-- Módulo 5/8 do Financeiro Avançado (acesso PRO).
-- Metas de faturamento e lucro, mensais ou anuais.
-- O progresso é calculado em tempo real a partir de
-- financial_transactions — esta tabela só guarda o ALVO.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.financial_goals (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  goal_type     TEXT NOT NULL CHECK (goal_type IN ('revenue', 'profit')),
  period_type   TEXT NOT NULL CHECK (period_type IN ('monthly', 'yearly')),
  period_key    TEXT NOT NULL,           -- 'monthly' → '2026-06' / 'yearly' → '2026'
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (company_id, goal_type, period_type, period_key)
);

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_goals_tenant" ON public.financial_goals;
CREATE POLICY "financial_goals_tenant" ON public.financial_goals FOR ALL
  USING      (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_financial_goals_company ON public.financial_goals(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_goals_period   ON public.financial_goals(period_type, period_key);
