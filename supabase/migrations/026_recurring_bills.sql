-- ============================================================
-- PRECY+ — Migration 026: Contas Recorrentes (Financeiro Avançado)
-- ============================================================
-- Módulo 2/8 do Financeiro Avançado (acesso PRO).
-- Cadastro de contas que se repetem (Canva, aluguel, salários...).
-- Ao vencer, gera automaticamente um lançamento em financial_transactions.
-- A geração é "lazy": verificada no frontend ao abrir o módulo
-- (não depende de cron/Edge Function, que não está disponível neste projeto).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recurring_bills (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  cost_center_id  UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,                 -- Ex: "Canva", "Aluguel"
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  periodicity     TEXT NOT NULL DEFAULT 'monthly'
                    CHECK (periodicity IN ('weekly','biweekly','monthly','yearly')),
  due_day         INTEGER,                       -- dia do mês de vencimento (1-31), usado quando monthly/yearly
  next_due_date   DATE NOT NULL,                  -- próxima data de vencimento calculada
  is_active       BOOLEAN DEFAULT TRUE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_bills_tenant" ON public.recurring_bills;
CREATE POLICY "recurring_bills_tenant" ON public.recurring_bills FOR ALL
  USING      (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_recurring_bills_company  ON public.recurring_bills(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_due_date ON public.recurring_bills(next_due_date);

-- ── Vincular financial_transactions à conta recorrente que a gerou ──
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS recurring_bill_id UUID REFERENCES public.recurring_bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_recurring
  ON public.financial_transactions(recurring_bill_id);

-- ── Função: calcula a próxima data de vencimento a partir de uma data base ──
CREATE OR REPLACE FUNCTION public.calc_next_due_date(
  p_periodicity TEXT,
  p_base_date   DATE,
  p_due_day     INTEGER DEFAULT NULL
) RETURNS DATE LANGUAGE plpgsql AS $$
BEGIN
  CASE p_periodicity
    WHEN 'weekly'   THEN RETURN p_base_date + INTERVAL '7 days';
    WHEN 'biweekly' THEN RETURN p_base_date + INTERVAL '14 days';
    WHEN 'yearly'   THEN RETURN p_base_date + INTERVAL '1 year';
    ELSE                 RETURN p_base_date + INTERVAL '1 month'; -- monthly (default)
  END CASE;
END;
$$;
