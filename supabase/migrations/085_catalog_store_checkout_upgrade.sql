-- ============================================================
-- 085_catalog_store_checkout_upgrade.sql
--
-- Loja virtual do Catálogo Online: endereço de entrega estruturado,
-- dados do frete escolhido e rastreamento — tudo como SNAPSHOT em
-- `orders` (nunca lido de volta de `customers`/`catalog_settings`), para
-- não alterar retroativamente um pedido já feito se o cliente ou a loja
-- mudarem esses dados depois.
--
-- Não apaga nem recria nada existente — só ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_email        TEXT,
  ADD COLUMN IF NOT EXISTS delivery_cep           TEXT,
  ADD COLUMN IF NOT EXISTS delivery_street        TEXT,
  ADD COLUMN IF NOT EXISTS delivery_number        TEXT,
  ADD COLUMN IF NOT EXISTS delivery_complement    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_neighborhood  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city          TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state         TEXT,
  ADD COLUMN IF NOT EXISTS shipping_service        TEXT,
  ADD COLUMN IF NOT EXISTS shipping_days           INTEGER,
  ADD COLUMN IF NOT EXISTS tracking_code           TEXT;

COMMENT ON COLUMN public.orders.delivery_email IS 'E-mail informado no checkout do Catálogo Online (snapshot — não é o e-mail atual do cliente).';
COMMENT ON COLUMN public.orders.shipping_service IS 'Nome da modalidade de frete escolhida (ex.: "PAC", "SEDEX") — cotada e revalidada no servidor no momento da compra.';
COMMENT ON COLUMN public.orders.tracking_code IS 'Código de rastreamento dos Correios/transportadora, quando a etiqueta for gerada/confirmada.';
