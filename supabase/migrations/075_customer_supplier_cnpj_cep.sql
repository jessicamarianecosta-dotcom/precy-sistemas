-- ─── 075: Preenchimento automático de CNPJ/CEP em Clientes e Fornecedores ────
-- Adiciona os campos de endereço detalhado e dados de CNPJ que o cadastro
-- automático (BrasilAPI + ViaCEP) preenche, e uma constraint de CNPJ/CPF
-- único por empresa (tenant) para evitar duplicidade acidental.

-- ── customers ──────────────────────────────────────────────────────────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS person_type         TEXT, -- 'pf' | 'pj' (null = cadastros antigos, não migrados)
  ADD COLUMN IF NOT EXISTS trade_name           TEXT, -- Nome fantasia (quando PJ)
  ADD COLUMN IF NOT EXISTS zip_code             TEXT,
  ADD COLUMN IF NOT EXISTS street               TEXT,
  ADD COLUMN IF NOT EXISTS number               TEXT,
  ADD COLUMN IF NOT EXISTS complement           TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood         TEXT,
  ADD COLUMN IF NOT EXISTS ibge_code            TEXT,
  ADD COLUMN IF NOT EXISTS cnae                 TEXT,
  ADD COLUMN IF NOT EXISTS registration_status  TEXT, -- Situação cadastral (ex: "ATIVA")
  ADD COLUMN IF NOT EXISTS opening_date         DATE;

-- ── suppliers ──────────────────────────────────────────────────────────────
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS number               TEXT,
  ADD COLUMN IF NOT EXISTS complement           TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood         TEXT,
  ADD COLUMN IF NOT EXISTS ibge_code            TEXT,
  ADD COLUMN IF NOT EXISTS cnae                 TEXT,
  ADD COLUMN IF NOT EXISTS registration_status  TEXT,
  ADD COLUMN IF NOT EXISTS opening_date         DATE;

-- ── CNPJ/CPF único por empresa (tenant) ───────────────────────────────────
-- Índice único parcial sobre o documento normalizado (só dígitos), ignorando
-- registros sem documento. Um mesmo CNPJ pode existir em contas diferentes —
-- a unicidade é sempre por company_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_company_document_unique
  ON public.customers (company_id, regexp_replace(cpf_cnpj, '\D', '', 'g'))
  WHERE cpf_cnpj IS NOT NULL AND regexp_replace(cpf_cnpj, '\D', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_company_document_unique
  ON public.suppliers (company_id, regexp_replace(document, '\D', '', 'g'))
  WHERE document IS NOT NULL AND regexp_replace(document, '\D', '', 'g') <> '';
