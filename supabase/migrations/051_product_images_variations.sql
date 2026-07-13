-- ============================================================
-- PRECY+ — Migration 051: Galeria de fotos e variações de produtos
-- ============================================================
-- Tabelas normalizadas (não JSON) para:
--   • product_images                — até 4 fotos por produto (sort_order 0 = capa)
--   • product_variation_groups      — grupos de variação livres (ex: "Cor", "Tamanho")
--   • product_variation_options     — opções de cada grupo (ex: "Branco", "Preto")
--   • product_variants              — combinações reais geradas (1 opção por grupo),
--                                      com preço/estoque/sku/prazo/peso/imagem opcionais
--   • product_variant_option_values — join: quais opções compõem cada variante
--
-- Estoque de variação (stock_quantity) é um conceito NOVO e SEPARADO do
-- estoque de matéria-prima (inventory/product_materials, usado para custo).
-- ============================================================

-- ── product_images ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_images (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  url        TEXT NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id, sort_order);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_images_tenant" ON public.product_images;
CREATE POLICY "product_images_tenant" ON public.product_images FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "product_images_public_read" ON public.product_images;
CREATE POLICY "product_images_public_read" ON public.product_images FOR SELECT
  TO anon
  USING (
    public.company_has_catalog_access(company_id)
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.is_published_catalog = true
    )
  );

-- Limite de 4 fotos por produto — defesa em profundidade (UI já bloqueia antes)
CREATE OR REPLACE FUNCTION public.check_product_images_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.product_images WHERE product_id = NEW.product_id;
  IF v_count >= 4 THEN
    RAISE EXCEPTION 'Limite de 4 fotos por produto atingido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_product_images_limit ON public.product_images;
CREATE TRIGGER trg_check_product_images_limit
  BEFORE INSERT ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.check_product_images_limit();

-- ── product_variation_groups ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variation_groups (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pvg_product ON public.product_variation_groups(product_id, sort_order);

ALTER TABLE public.product_variation_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variation_groups_tenant" ON public.product_variation_groups;
CREATE POLICY "product_variation_groups_tenant" ON public.product_variation_groups FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "product_variation_groups_public_read" ON public.product_variation_groups;
CREATE POLICY "product_variation_groups_public_read" ON public.product_variation_groups FOR SELECT
  TO anon
  USING (
    public.company_has_catalog_access(company_id)
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.is_published_catalog = true
    )
  );

-- ── product_variation_options ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variation_options (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id   UUID REFERENCES public.product_variation_groups(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  value      TEXT NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (group_id, value)
);

CREATE INDEX IF NOT EXISTS idx_pvo_group ON public.product_variation_options(group_id, sort_order);

ALTER TABLE public.product_variation_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variation_options_tenant" ON public.product_variation_options;
CREATE POLICY "product_variation_options_tenant" ON public.product_variation_options FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "product_variation_options_public_read" ON public.product_variation_options;
CREATE POLICY "product_variation_options_public_read" ON public.product_variation_options FOR SELECT
  TO anon
  USING (
    public.company_has_catalog_access(company_id)
    AND EXISTS (
      SELECT 1 FROM public.product_variation_groups g
      JOIN public.products p ON p.id = g.product_id
      WHERE g.id = group_id AND p.is_published_catalog = true
    )
  );

-- ── product_variants ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variants (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id     UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  company_id     UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  sku            TEXT,
  price          NUMERIC(12,2),
  stock_quantity INT,
  lead_time_days INT,
  weight_kg      NUMERIC(10,3),
  image_id       UUID REFERENCES public.product_images(id) ON DELETE SET NULL,
  is_active      BOOLEAN DEFAULT true NOT NULL,
  sort_order     INT DEFAULT 0 NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variants_tenant" ON public.product_variants;
CREATE POLICY "product_variants_tenant" ON public.product_variants FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "product_variants_public_read" ON public.product_variants;
CREATE POLICY "product_variants_public_read" ON public.product_variants FOR SELECT
  TO anon
  USING (
    is_active = true
    AND public.company_has_catalog_access(company_id)
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.is_published_catalog = true
    )
  );

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── product_variant_option_values ────────────────────────────
-- Join: cada linha diz "esta variante usa esta opção deste grupo".
-- PRIMARY KEY (variant_id, group_id) garante no máximo 1 opção por grupo por variante.
CREATE TABLE IF NOT EXISTS public.product_variant_option_values (
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE NOT NULL,
  option_id  UUID REFERENCES public.product_variation_options(id) ON DELETE CASCADE NOT NULL,
  group_id   UUID REFERENCES public.product_variation_groups(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (variant_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_pvov_option ON public.product_variant_option_values(option_id);

ALTER TABLE public.product_variant_option_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variant_option_values_tenant" ON public.product_variant_option_values;
CREATE POLICY "product_variant_option_values_tenant" ON public.product_variant_option_values FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = variant_id AND v.company_id = public.get_user_company_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = variant_id AND v.company_id = public.get_user_company_id())
  );

DROP POLICY IF EXISTS "product_variant_option_values_public_read" ON public.product_variant_option_values;
CREATE POLICY "product_variant_option_values_public_read" ON public.product_variant_option_values FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
      WHERE v.id = variant_id
        AND v.is_active = true
        AND p.is_published_catalog = true
        AND public.company_has_catalog_access(v.company_id)
    )
  );
