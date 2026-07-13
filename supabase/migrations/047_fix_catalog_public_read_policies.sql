-- ============================================================
-- PRECY+ — Migration 047: Corrige leitura pública do Catálogo Online
-- ============================================================
-- BUG: as policies públicas (catalog_categories_public_read,
-- catalog_settings_public_read, products_catalog_public_read) checavam
-- `current_plan = 'pro'` diretamente, mas o resto do app trata `role =
-- 'developer'` e `subscription_status = 'trialing'` (dentro do trial)
-- como PRO efetivo também (ver middleware.ts, checkPlan(), useSubscription()).
-- current_plan só vira 'pro' de fato depois que o Stripe processa o
-- checkout — durante o trial ele permanece 'basic'. Resultado: a loja
-- pública de QUALQUER empresa em trial ou developer retornava 404.
--
-- Corrige usando a mesma função company_has_catalog_access() já usada
-- pelos triggers de limite (045), garantindo a mesma regra de acesso em
-- escrita e leitura.
-- ============================================================

DROP POLICY IF EXISTS "catalog_categories_public_read" ON public.catalog_categories;
CREATE POLICY "catalog_categories_public_read" ON public.catalog_categories FOR SELECT
  TO anon
  USING (public.company_has_catalog_access(company_id));

DROP POLICY IF EXISTS "catalog_settings_public_read" ON public.catalog_settings;
CREATE POLICY "catalog_settings_public_read" ON public.catalog_settings FOR SELECT
  TO anon
  USING (public.company_has_catalog_access(company_id));

DROP POLICY IF EXISTS "products_catalog_public_read" ON public.products;
CREATE POLICY "products_catalog_public_read" ON public.products FOR SELECT
  TO anon
  USING (is_published_catalog = true AND public.company_has_catalog_access(company_id));
