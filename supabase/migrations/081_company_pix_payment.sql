-- ============================================================
-- Chave PIX da empresa + snapshot em orçamentos/pedidos
--
-- A chave PIX é cadastrada uma vez em `companies` (Configurações) e passa
-- a ser sugerida automaticamente em orçamentos e pedidos. Para não deixar
-- documentos comerciais já emitidos mudando de conteúdo quando o usuário
-- altera a chave no futuro, `budgets` e `orders` recebem as MESMAS colunas
-- como snapshot: são preenchidas no momento da criação do
-- orçamento/pedido (com o que estiver configurado então) e nunca mais
-- tocadas por uma edição posterior ou por uma troca de chave nas
-- Configurações.
--
-- RLS: nenhuma policy nova é necessária — as tabelas já restringem por
-- linha (company_id / user_id), o que cobre automaticamente as colunas
-- novas.
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pix_type  TEXT,
  ADD COLUMN IF NOT EXISTS pix_key   TEXT,
  ADD COLUMN IF NOT EXISTS pix_label TEXT;

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS pix_type  TEXT,
  ADD COLUMN IF NOT EXISTS pix_key   TEXT,
  ADD COLUMN IF NOT EXISTS pix_label TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_type  TEXT,
  ADD COLUMN IF NOT EXISTS pix_key   TEXT,
  ADD COLUMN IF NOT EXISTS pix_label TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_pix_type_check'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_pix_type_check
      CHECK (pix_type IS NULL OR pix_type IN ('cpf','cnpj','email','telefone','aleatoria'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_pix_type_check'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_pix_type_check
      CHECK (pix_type IS NULL OR pix_type IN ('cpf','cnpj','email','telefone','aleatoria'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_pix_type_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_pix_type_check
      CHECK (pix_type IS NULL OR pix_type IN ('cpf','cnpj','email','telefone','aleatoria'));
  END IF;
END $$;
