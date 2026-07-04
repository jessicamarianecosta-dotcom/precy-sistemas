-- 040_expense_installments.sql
-- Parcelamento de despesas: cada parcela é uma linha própria de financial_transactions,
-- agrupada por expense_group_id. Nenhuma coluna nova é obrigatória — tudo aditivo.

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS due_date            DATE,
  ADD COLUMN IF NOT EXISTS payment_date         DATE,
  ADD COLUMN IF NOT EXISTS payment_method       TEXT,
  ADD COLUMN IF NOT EXISTS card_name            TEXT,
  ADD COLUMN IF NOT EXISTS card_brand           TEXT,
  ADD COLUMN IF NOT EXISTS card_last4           TEXT,
  ADD COLUMN IF NOT EXISTS card_closing_day     SMALLINT,
  ADD COLUMN IF NOT EXISTS card_due_day         SMALLINT,
  ADD COLUMN IF NOT EXISTS expense_group_id     UUID,
  ADD COLUMN IF NOT EXISTS installment_number   INT;

CREATE INDEX IF NOT EXISTS idx_ft_expense_group ON public.financial_transactions(expense_group_id);
CREATE INDEX IF NOT EXISTS idx_ft_due_date ON public.financial_transactions(due_date);
