-- ============================================================
-- PRECY+ — Migration 045: Pedidos do Catálogo + limites (defesa em profundidade)
-- ============================================================
-- 1. orders.source / orders.catalog_checkout_ref — identifica pedidos
--    originados da loja pública e permite casar o webhook de pagamento
--    de forma idempotente.
-- 2. Triggers que bloqueiam no banco (não confiar só na UI/API):
--    • publicar produto no catálogo além do limite de 500, ou sem ser PRO
--    • criar categoria além do limite de 20, ou sem ser PRO
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' NOT NULL CHECK (source IN ('manual','catalog')),
  ADD COLUMN IF NOT EXISTS catalog_checkout_ref TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(company_id, source);

-- ── Helper: empresa tem acesso PRO efetivo? (plano pro, trial, ou developer) ──
CREATE OR REPLACE FUNCTION public.company_has_catalog_access(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND (
        c.role = 'developer'
        OR c.current_plan = 'pro'
        OR (c.subscription_status = 'trialing' AND (c.trial_end IS NULL OR c.trial_end > NOW()))
      )
  );
$$;

-- ── Trigger: limite de produtos publicados no catálogo (500, só PRO) ──
CREATE OR REPLACE FUNCTION public.check_catalog_product_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.is_published_catalog = true
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.is_published_catalog, false) = false) THEN

    IF NOT public.company_has_catalog_access(NEW.company_id) THEN
      RAISE EXCEPTION 'Catálogo Online é exclusivo do Plano PRO';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.products
      WHERE company_id = NEW.company_id
        AND is_published_catalog = true
        AND id <> NEW.id;

    IF v_count >= 500 THEN
      RAISE EXCEPTION 'Limite de 500 produtos publicados no Catálogo Online atingido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_catalog_product_limit ON public.products;
CREATE TRIGGER trg_check_catalog_product_limit
  BEFORE INSERT OR UPDATE OF is_published_catalog ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_catalog_product_limit();

-- ── Trigger: limite de categorias do catálogo (20, só PRO) ──
CREATE OR REPLACE FUNCTION public.check_catalog_category_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT public.company_has_catalog_access(NEW.company_id) THEN
    RAISE EXCEPTION 'Catálogo Online é exclusivo do Plano PRO';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO v_count FROM public.catalog_categories
      WHERE company_id = NEW.company_id;

    IF v_count >= 20 THEN
      RAISE EXCEPTION 'Limite de 20 categorias no Catálogo Online atingido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_catalog_category_limit ON public.catalog_categories;
CREATE TRIGGER trg_check_catalog_category_limit
  BEFORE INSERT ON public.catalog_categories
  FOR EACH ROW EXECUTE FUNCTION public.check_catalog_category_limit();
