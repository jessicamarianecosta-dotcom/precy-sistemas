-- ============================================================
-- PRECY+ — Migration 022: Tabela product_categories
-- ============================================================
-- Categorias de produtos por empresa, persistidas no Supabase.
-- Permite criar, listar e reutilizar categorias customizadas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (company_id, name)
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories_tenant" ON public.product_categories;
CREATE POLICY "product_categories_tenant" ON public.product_categories FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_product_categories_company
  ON public.product_categories(company_id);

-- Seed: categorias padrão para cada empresa já existente
-- (executar manualmente se quiser pré-popular)
-- INSERT INTO public.product_categories (company_id, name)
-- SELECT id, unnest(ARRAY['Banner','Adesivo','Papelaria','Caneca','Copo',
--   'Quadro','Vela','Cosmético','Roupa','Acessório','Embalagem','Kit','Outro'])
-- FROM public.companies
-- ON CONFLICT (company_id, name) DO NOTHING;
