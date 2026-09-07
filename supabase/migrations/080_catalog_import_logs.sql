-- ============================================================
-- PRECY+ — Migration 080: Log de importação de catálogo (Produtos)
-- ============================================================
-- Registra cada execução da função "Importar Catálogo" (Produtos → Importar
-- Catálogo): fonte genérica de PDF → extração → revisão → importação.
-- Tabela por empresa (não global) para caber na mesma RLS tenant já usada
-- pelo resto do sistema — o acesso à FUNÇÃO em si (só jessicamarianecosta@
-- gmail.com) é imposto na API (lib/catalog/importServerAuth.ts), não aqui.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_import_logs (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id             UUID NOT NULL,
  source_label        TEXT DEFAULT 'PDF' NOT NULL,
  source_filename     TEXT,
  total_found         INT DEFAULT 0 NOT NULL,
  imported_count      INT DEFAULT 0 NOT NULL,
  updated_count       INT DEFAULT 0 NOT NULL,
  skipped_count       INT DEFAULT 0 NOT NULL,
  review_needed_count INT DEFAULT 0 NOT NULL,
  errors              JSONB DEFAULT '[]' NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.product_import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_import_logs_tenant" ON public.product_import_logs;
CREATE POLICY "product_import_logs_tenant" ON public.product_import_logs FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_product_import_logs_company
  ON public.product_import_logs(company_id, created_at DESC);
