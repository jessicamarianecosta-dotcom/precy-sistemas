-- 076: Módulo Declaração de Conteúdo + endereço estruturado da empresa (remetente)

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS zip_code     TEXT,
  ADD COLUMN IF NOT EXISTS street       TEXT,
  ADD COLUMN IF NOT EXISTS number       TEXT,
  ADD COLUMN IF NOT EXISTS complement   TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS state        TEXT;

CREATE TABLE IF NOT EXISTS public.content_declarations (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id              UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  customer_id             UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id                UUID REFERENCES public.orders(id) ON DELETE SET NULL,

  sender_name             TEXT NOT NULL,
  sender_document         TEXT,
  sender_zip_code         TEXT,
  sender_street           TEXT,
  sender_number           TEXT,
  sender_complement       TEXT,
  sender_neighborhood     TEXT,
  sender_city             TEXT,
  sender_state            TEXT,

  recipient_name          TEXT NOT NULL,
  recipient_document      TEXT,
  recipient_zip_code      TEXT,
  recipient_street        TEXT,
  recipient_number        TEXT,
  recipient_complement    TEXT,
  recipient_neighborhood  TEXT,
  recipient_city          TEXT,
  recipient_state         TEXT,

  declaration_city        TEXT NOT NULL,
  declaration_date        DATE NOT NULL DEFAULT CURRENT_DATE,

  total_quantity          NUMERIC NOT NULL DEFAULT 0,
  total_value             NUMERIC NOT NULL DEFAULT 0,
  total_weight_kg         NUMERIC(10,3),

  notes                   TEXT,

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.content_declaration_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  declaration_id  UUID REFERENCES public.content_declarations(id) ON DELETE CASCADE NOT NULL,
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  quantity        NUMERIC NOT NULL DEFAULT 1,
  value           NUMERIC NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.content_declarations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_declaration_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_declarations_company_all" ON public.content_declarations
  FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE POLICY "content_declaration_items_via_declaration" ON public.content_declaration_items
  FOR ALL
  USING (declaration_id IN (
    SELECT id FROM public.content_declarations
    WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  ))
  WITH CHECK (declaration_id IN (
    SELECT id FROM public.content_declarations
    WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  ));

CREATE INDEX IF NOT EXISTS idx_content_declarations_company   ON public.content_declarations(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_declarations_customer  ON public.content_declarations(customer_id);
CREATE INDEX IF NOT EXISTS idx_content_declarations_order     ON public.content_declarations(order_id);
CREATE INDEX IF NOT EXISTS idx_content_declaration_items_decl ON public.content_declaration_items(declaration_id);
