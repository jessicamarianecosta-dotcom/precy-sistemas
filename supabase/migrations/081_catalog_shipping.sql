-- ============================================================
-- PRECY+ — Migration 081: Envio real do Catálogo Online (SuperFrete)
-- ============================================================
-- Fecha as lacunas da auditoria do fluxo Catálogo → Frete → Etiqueta:
--   1. products: peso/dimensões reais, usados na cotação de frete
--      (antes o checkout mandava valores fixos fake para qualquer produto).
--   2. catalog_shipping_settings — remetente/origem por empresa (1:1),
--      substitui o SUPERFRETE_ORIGIN_CEP global (uma empresa não pode usar
--      o endereço de outra como origem).
--   3. order_shipments — etiqueta/envio gerado no SuperFrete, vinculado
--      1:1 ao pedido (nunca duas etiquetas válidas para o mesmo pedido).
--   4. orders: colunas denormalizadas de rastreio (mesmo padrão de
--      order_items/variant_* na migration 053) para exibição rápida sem
--      join, tanto no painel quanto na tela do cliente.
-- ============================================================

-- ── products: peso e dimensões para cálculo de frete ────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shipping_weight_kg NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS shipping_length_cm NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS shipping_width_cm  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS shipping_height_cm NUMERIC(10,2);

-- ── catalog_shipping_settings (1:1 por empresa) ──────────────
CREATE TABLE IF NOT EXISTS public.catalog_shipping_settings (
  company_id      UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_name     TEXT NOT NULL,
  sender_document TEXT NOT NULL,
  sender_phone    TEXT NOT NULL,
  origin_cep      TEXT NOT NULL,
  origin_street   TEXT NOT NULL,
  origin_number   TEXT NOT NULL,
  origin_complement TEXT,
  origin_district TEXT NOT NULL,
  origin_city     TEXT NOT NULL,
  origin_state    TEXT NOT NULL,
  default_weight_kg  NUMERIC(10,3) DEFAULT 0.3 NOT NULL,
  default_length_cm  NUMERIC(10,2) DEFAULT 20 NOT NULL,
  default_width_cm   NUMERIC(10,2) DEFAULT 15 NOT NULL,
  default_height_cm  NUMERIC(10,2) DEFAULT 5 NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.catalog_shipping_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_shipping_settings_tenant" ON public.catalog_shipping_settings;
CREATE POLICY "catalog_shipping_settings_tenant" ON public.catalog_shipping_settings FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Sem leitura pública: origem/remetente é dado interno, só o backend
-- (supabaseAdmin) usa isso para cotar/gerar etiqueta — cliente da loja
-- nunca precisa ver o endereço do remetente.

DROP TRIGGER IF EXISTS trg_catalog_shipping_settings_updated_at ON public.catalog_shipping_settings;
CREATE TRIGGER trg_catalog_shipping_settings_updated_at
  BEFORE UPDATE ON public.catalog_shipping_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── order_shipments — 1 etiqueta válida por pedido ───────────
CREATE TABLE IF NOT EXISTS public.order_shipments (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id           UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  company_id         UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  provider           TEXT DEFAULT 'superfrete' NOT NULL,
  provider_shipment_id TEXT NOT NULL,
  service_name       TEXT,
  status             TEXT DEFAULT 'pending' NOT NULL
                        CHECK (status IN ('pending','generated','posted','in_transit','delivered','problem','cancelled')),
  tracking_code      TEXT,
  tracking_url       TEXT,
  label_url          TEXT,
  price              NUMERIC(12,2),
  raw_response       JSONB,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (order_id),
  UNIQUE (provider, provider_shipment_id)
);

ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_shipments_tenant" ON public.order_shipments;
CREATE POLICY "order_shipments_tenant" ON public.order_shipments FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_order_shipments_order ON public.order_shipments(order_id);

DROP TRIGGER IF EXISTS trg_order_shipments_updated_at ON public.order_shipments;
CREATE TRIGGER trg_order_shipments_updated_at
  BEFORE UPDATE ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── orders: espelho rápido de rastreio (evita join na listagem/kanban) ──
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_service TEXT,
  ADD COLUMN IF NOT EXISTS tracking_code    TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url     TEXT,
  ADD COLUMN IF NOT EXISTS shipment_status  TEXT;

-- Mantém orders.tracking_code/tracking_url/shipment_status em sincronia com
-- order_shipments sem precisar tocar em toda rota que já escreve em orders.
CREATE OR REPLACE FUNCTION public.sync_order_shipment_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.orders
    SET shipping_service = NEW.service_name,
        tracking_code    = NEW.tracking_code,
        tracking_url     = NEW.tracking_url,
        shipment_status  = NEW.status,
        updated_at       = NOW()
    WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_shipment_fields ON public.order_shipments;
CREATE TRIGGER trg_sync_order_shipment_fields
  AFTER INSERT OR UPDATE ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_shipment_fields();
