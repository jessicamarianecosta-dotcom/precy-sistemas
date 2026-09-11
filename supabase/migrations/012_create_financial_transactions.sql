-- ============================================================
-- PRECY+ — Migration 013: Criar tabela financial_transactions
-- Execute ESTE arquivo no SQL Editor do Supabase:
-- app.supabase.com → SQL Editor → New Query → Cole → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category     TEXT NOT NULL DEFAULT 'outros',
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  description  TEXT,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT DEFAULT 'received',
  client_name  TEXT,
  order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  budget_id    UUID,
  installments INT  DEFAULT 1,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Users can manage own financial transactions"
  ON public.financial_transactions;

CREATE POLICY "Users can manage own financial transactions"
  ON public.financial_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_ft_company_date
  ON public.financial_transactions(company_id, date DESC);
