-- ============================================================
-- PRECY+ — Migration 050: Catálogo Online premium — campos novos
-- ============================================================
-- Suporta a reformulação da tela de Configurações do Catálogo (redes
-- sociais extras, contato completo, SEO) e o preço promocional de
-- produtos na loja pública (selo "Promoção").
-- ============================================================

ALTER TABLE public.catalog_settings
  ADD COLUMN IF NOT EXISTS tiktok            TEXT,
  ADD COLUMN IF NOT EXISTS youtube           TEXT,
  ADD COLUMN IF NOT EXISTS pinterest         TEXT,
  ADD COLUMN IF NOT EXISTS website           TEXT,
  ADD COLUMN IF NOT EXISTS phone             TEXT,
  ADD COLUMN IF NOT EXISTS email             TEXT,
  ADD COLUMN IF NOT EXISTS city              TEXT,
  ADD COLUMN IF NOT EXISTS state             TEXT,
  ADD COLUMN IF NOT EXISTS zip_code          TEXT,
  ADD COLUMN IF NOT EXISTS business_hours    TEXT,
  ADD COLUMN IF NOT EXISTS seo_title         TEXT,
  ADD COLUMN IF NOT EXISTS seo_description   TEXT,
  ADD COLUMN IF NOT EXISTS seo_keywords      TEXT,
  ADD COLUMN IF NOT EXISTS seo_image_url     TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS catalog_promo_price NUMERIC(12,2);
