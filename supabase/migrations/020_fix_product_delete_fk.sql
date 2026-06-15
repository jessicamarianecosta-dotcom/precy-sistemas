-- ============================================================
-- PRECY+ — Migration 020: Fix Delete de Produtos Antigos
-- ============================================================
-- PROBLEMA:
--   order_items.product_id e budget_items.product_id tinham FK
--   sem ON DELETE SET NULL. Isso bloqueava silenciosamente o
--   delete de qualquer produto que já estava em pedidos ou
--   orçamentos — comportamento que afetava especialmente
--   produtos antigos que acumularam histórico.
--
-- SOLUÇÃO:
--   1. Recriar FKs com ON DELETE SET NULL (preserva histórico)
--   2. Garantir ON DELETE CASCADE em product_materials
--   3. Recriar policy RLS de produtos com função correta
--   4. Índices de performance
-- ============================================================

-- ── 1. order_items: product_id → SET NULL ao deletar produto ──
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE SET NULL;

-- ── 2. budget_items: product_id → SET NULL ao deletar produto ──
ALTER TABLE public.budget_items
  DROP CONSTRAINT IF EXISTS budget_items_product_id_fkey;

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE SET NULL;

-- ── 3. product_materials: CASCADE (apaga materiais com o produto) ──
ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS product_materials_product_id_fkey;

ALTER TABLE public.product_materials
  ADD CONSTRAINT product_materials_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE CASCADE;

-- ── 4. Garantir função helper robusta para RLS ──
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── 5. Recriar policy products_tenant garantindo DELETE ──
DROP POLICY IF EXISTS "products_tenant"              ON public.products;
DROP POLICY IF EXISTS "Users can manage own products" ON public.products;

CREATE POLICY "products_tenant" ON public.products FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- ── 6. Índices de performance ──
CREATE INDEX IF NOT EXISTS idx_order_items_product_id  ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_product_id ON public.budget_items(product_id);
