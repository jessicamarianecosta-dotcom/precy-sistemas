-- 029_payment_history.sql
-- Histórico de Recebimentos: cada pagamento parcial vira um registro individual.

CREATE TABLE IF NOT EXISTS payment_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES customers(id),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date   DATE NOT NULL,
  payment_method TEXT,
  observation    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES auth.users(id)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_payment_history_order   ON payment_history(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_company ON payment_history(company_id, payment_date DESC);

-- RLS
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_history_tenant" ON payment_history
  FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
