-- ─── 034: Módulo Fornecedores ────────────────────────────────────────────────

-- Tabela principal de fornecedores
CREATE TABLE IF NOT EXISTS public.suppliers (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  legal_name          TEXT,
  document            TEXT,
  state_registration  TEXT,
  phone               TEXT,
  whatsapp            TEXT,
  email               TEXT,
  website             TEXT,
  contact_person      TEXT,
  contact_role        TEXT,
  zip_code            TEXT,
  address             TEXT,
  city                TEXT,
  supplier_state      TEXT,
  country             TEXT DEFAULT 'Brasil',
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  category            TEXT,
  payment_terms       TEXT,
  avg_delivery_days   INTEGER,
  min_order_value     NUMERIC,
  freight_type        TEXT,
  carrier             TEXT,
  payment_methods     TEXT[] DEFAULT '{}',
  rating_delivery     SMALLINT CHECK (rating_delivery BETWEEN 1 AND 5),
  rating_price        SMALLINT CHECK (rating_price BETWEEN 1 AND 5),
  rating_quality      SMALLINT CHECK (rating_quality BETWEEN 1 AND 5),
  rating_service      SMALLINT CHECK (rating_service BETWEEN 1 AND 5),
  rating_punctuality  SMALLINT CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_notes        TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Materiais/produtos vinculados a fornecedores
CREATE TABLE IF NOT EXISTS public.supplier_materials (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  supplier_id         UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  inventory_id        UUID,
  material_name       TEXT NOT NULL,
  unit                TEXT NOT NULL DEFAULT 'un',
  current_price       NUMERIC NOT NULL DEFAULT 0,
  previous_price      NUMERIC,
  last_purchase_date  DATE,
  is_primary          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Compras realizadas
CREATE TABLE IF NOT EXISTS public.supplier_purchases (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id               UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  supplier_id              UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  purchase_number          TEXT,
  purchase_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery        DATE,
  freight                  NUMERIC NOT NULL DEFAULT 0,
  discount                 NUMERIC NOT NULL DEFAULT 0,
  taxes                    NUMERIC NOT NULL DEFAULT 0,
  subtotal                 NUMERIC NOT NULL DEFAULT 0,
  total                    NUMERIC NOT NULL DEFAULT 0,
  status                   TEXT NOT NULL DEFAULT 'pending',
  payment_status           TEXT NOT NULL DEFAULT 'pending',
  payment_due_date         DATE,
  notes                    TEXT,
  financial_transaction_id UUID,
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- Itens de cada compra
CREATE TABLE IF NOT EXISTS public.supplier_purchase_items (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id   UUID REFERENCES public.supplier_purchases(id) ON DELETE CASCADE NOT NULL,
  inventory_id  UUID,
  material_name TEXT NOT NULL,
  quantity      NUMERIC NOT NULL DEFAULT 1,
  unit          TEXT NOT NULL DEFAULT 'un',
  unit_price    NUMERIC NOT NULL DEFAULT 0,
  subtotal      NUMERIC NOT NULL DEFAULT 0
);

-- Histórico de preços por material/fornecedor
CREATE TABLE IF NOT EXISTS public.material_price_history (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id           UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  supplier_id          UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  supplier_material_id UUID REFERENCES public.supplier_materials(id) ON DELETE SET NULL,
  inventory_id         UUID,
  material_name        TEXT NOT NULL,
  price                NUMERIC NOT NULL,
  purchase_id          UUID REFERENCES public.supplier_purchases(id) ON DELETE SET NULL,
  recorded_at          TIMESTAMPTZ DEFAULT now()
);

-- Coluna de fornecedor principal no estoque
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS primary_supplier_id UUID;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_materials     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_company_all" ON public.suppliers
  FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "supplier_materials_company_all" ON public.supplier_materials
  FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "supplier_purchases_company_all" ON public.supplier_purchases
  FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "supplier_purchase_items_via_purchase" ON public.supplier_purchase_items
  FOR ALL
  USING (purchase_id IN (
    SELECT id FROM public.supplier_purchases
    WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  ))
  WITH CHECK (purchase_id IN (
    SELECT id FROM public.supplier_purchases
    WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  ));

CREATE POLICY "material_price_history_company_all" ON public.material_price_history
  FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_suppliers_company ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_materials_supplier ON public.supplier_materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_supplier ON public.supplier_purchases(supplier_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_price_history_supplier ON public.material_price_history(supplier_id, recorded_at DESC);
