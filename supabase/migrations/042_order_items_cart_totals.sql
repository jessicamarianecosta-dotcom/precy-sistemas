-- 042: Pedidos multi-item (carrinho) + totais completos
-- orders: frete e acréscimos (desconto geral já existia)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_charges NUMERIC DEFAULT 0;

-- order_items: paridade com budget_items (mesma evolução das migrations 007/030/031)
ALTER TABLE public.order_items
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS discount         NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type    TEXT DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS width            NUMERIC,
  ADD COLUMN IF NOT EXISTS height           NUMERIC,
  ADD COLUMN IF NOT EXISTS area             NUMERIC,
  ADD COLUMN IF NOT EXISTS measurement_unit TEXT DEFAULT 'm',
  ADD COLUMN IF NOT EXISTS finishings       JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS finishing_type   TEXT,
  ADD COLUMN IF NOT EXISTS technical_notes  TEXT;
