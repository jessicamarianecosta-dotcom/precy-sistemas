-- 031: Especificações técnicas em produtos e itens de orçamento
-- products: acabamentos (JSONB), finalização (text), observações técnicas (text)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS finishings      JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS finishing_type  TEXT,
  ADD COLUMN IF NOT EXISTS technical_notes TEXT;

-- budget_items: medidas + specs (copiados do produto ou digitados manualmente)
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS width            NUMERIC,
  ADD COLUMN IF NOT EXISTS height           NUMERIC,
  ADD COLUMN IF NOT EXISTS area             NUMERIC,
  ADD COLUMN IF NOT EXISTS measurement_unit TEXT DEFAULT 'm',
  ADD COLUMN IF NOT EXISTS finishings       JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS finishing_type   TEXT,
  ADD COLUMN IF NOT EXISTS technical_notes  TEXT;
