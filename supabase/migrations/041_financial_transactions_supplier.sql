-- 041_financial_transactions_supplier.sql
-- Fornecedor no lançamento financeiro: cadastrado (supplier_id) ou manual
-- (somente supplier_name/document/phone, sem criar cadastro permanente).

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS supplier_id       UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_name     TEXT,
  ADD COLUMN IF NOT EXISTS supplier_document TEXT,
  ADD COLUMN IF NOT EXISTS supplier_phone    TEXT;

CREATE INDEX IF NOT EXISTS idx_ft_supplier_id ON public.financial_transactions(supplier_id);
