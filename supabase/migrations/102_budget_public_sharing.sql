-- ==============================
-- Orçamento digital interativo: link público, aprovação/reprovação,
-- rastreio de visualização e status de pagamento (PIX)
-- ==============================

-- Token opaco, não sequencial, para endereçar o orçamento publicamente
-- sem expor o id sequencial do banco nem exigir RLS anônima em budgets
-- (o acesso público é sempre via rota server-side com service role,
-- filtrando manualmente por esse token — mesmo padrão já usado em
-- orders.catalog_checkout_ref).
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT uuid_generate_v4();

UPDATE public.budgets SET public_token = uuid_generate_v4() WHERE public_token IS NULL;

ALTER TABLE public.budgets
  ALTER COLUMN public_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_public_token_key'
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_public_token_key UNIQUE (public_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_budgets_public_token ON public.budgets(public_token);
CREATE INDEX IF NOT EXISTS idx_budgets_company_status ON public.budgets(company_id, status);

-- Rastreio de envio/visualização pelo cliente
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Aprovação/reprovação feita pelo próprio cliente no link público
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Pagamento (PIX): QR Code gerado não significa pago — status só muda por
-- integração real ou conferência manual do administrador.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pix_txid TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_budget_payment_status'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT valid_budget_payment_status CHECK (payment_status IN ('pending','paid','partial'));
  END IF;
END $$;

-- Novo status 'viewed' (cliente abriu o link mas ainda não decidiu)
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS valid_budget_status;
ALTER TABLE public.budgets
  ADD CONSTRAINT valid_budget_status
  CHECK (status IN ('draft','sent','viewed','approved','rejected','converted'));
