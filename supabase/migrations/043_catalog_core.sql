-- ============================================================
-- PRECY+ — Migration 043: Catálogo Online (core) — exclusivo Plano PRO
-- ============================================================
-- Cria a estrutura base do módulo Catálogo Online:
--   • catalog_categories — categorias da loja de cada empresa (limite 20 no PRO)
--   • catalog_settings    — configuração 1:1 da loja pública (slug, branding, contato)
--   • colunas novas em products — publicação, categoria de catálogo, galeria,
--     prazo, preço inicial, modo de checkout, origem na Biblioteca Precy+
-- ============================================================

-- ── catalog_categories ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_categories (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (company_id, slug)
);

ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_categories_tenant" ON public.catalog_categories;
CREATE POLICY "catalog_categories_tenant" ON public.catalog_categories FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Leitura pública (loja) via role anon: apenas categorias de empresas PRO ativas
DROP POLICY IF EXISTS "catalog_categories_public_read" ON public.catalog_categories;
CREATE POLICY "catalog_categories_public_read" ON public.catalog_categories FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.current_plan = 'pro'
    )
  );

CREATE INDEX IF NOT EXISTS idx_catalog_categories_company ON public.catalog_categories(company_id);

-- ── catalog_settings (1:1 por empresa) ──────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_settings (
  company_id     UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  slug           TEXT UNIQUE NOT NULL,
  logo_url       TEXT,
  banner_url     TEXT,
  description    TEXT,
  whatsapp       TEXT,
  instagram      TEXT,
  facebook       TEXT,
  address        TEXT,
  theme_color    TEXT DEFAULT '#8B6C4F',
  checkout_mode  TEXT DEFAULT 'quote' NOT NULL CHECK (checkout_mode IN ('buy','quote')),
  policies_text  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.catalog_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_settings_tenant" ON public.catalog_settings;
CREATE POLICY "catalog_settings_tenant" ON public.catalog_settings FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Leitura pública (loja) — apenas de empresas PRO
DROP POLICY IF EXISTS "catalog_settings_public_read" ON public.catalog_settings;
CREATE POLICY "catalog_settings_public_read" ON public.catalog_settings FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.current_plan = 'pro'
    )
  );

CREATE INDEX IF NOT EXISTS idx_catalog_settings_slug ON public.catalog_settings(slug);

-- updated_at automático (reaproveita padrão de trigger genérico já usado no projeto)
DROP TRIGGER IF EXISTS trg_catalog_settings_updated_at ON public.catalog_settings;
CREATE TRIGGER trg_catalog_settings_updated_at
  BEFORE UPDATE ON public.catalog_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── products: colunas do Catálogo Online ────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_published_catalog  BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS catalog_category_id    UUID REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_photos         JSONB DEFAULT '[]' NOT NULL,
  ADD COLUMN IF NOT EXISTS catalog_lead_time_days INT,
  ADD COLUMN IF NOT EXISTS catalog_starting_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS catalog_checkout_mode  TEXT CHECK (catalog_checkout_mode IN ('buy','quote')),
  ADD COLUMN IF NOT EXISTS library_source_id      UUID;

CREATE INDEX IF NOT EXISTS idx_products_catalog_published
  ON public.products(company_id) WHERE is_published_catalog = true;

-- Leitura pública (loja) de produtos publicados de empresas PRO
DROP POLICY IF EXISTS "products_catalog_public_read" ON public.products;
CREATE POLICY "products_catalog_public_read" ON public.products FOR SELECT
  TO anon
  USING (
    is_published_catalog = true
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.current_plan = 'pro'
    )
  );
