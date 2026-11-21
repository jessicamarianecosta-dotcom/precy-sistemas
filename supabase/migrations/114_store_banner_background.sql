-- ============================================================
-- PRECY+ — Migration 114: Banner personalizável + Aparência da loja (fundo)
-- ============================================================
-- Evolui a vitrine pública (catalog_settings) com dois blocos novos,
-- mantendo catalog_settings como única fonte de verdade (sem tabela paralela):
--
--  1) Banner principal (hero) — altura, posição da imagem, cantos/largura,
--     exibição do texto sobreposto e um botão de destaque opcional.
--  2) Aparência da loja (fundo) — imagem própria OU tema pronto OU cor sólida,
--     aplicado por trás de toda a vitrine (não só do banner).
--
-- Todas as colunas têm default seguro para não quebrar lojas já publicadas
-- (ex: lumilife, criativa-personalizados) — nenhuma fica NULL "quebrando" o layout.
-- ============================================================

-- ── Banner principal ──────────────────────────────────────────
ALTER TABLE public.catalog_settings
  ADD COLUMN IF NOT EXISTS banner_height        TEXT NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS banner_image_position TEXT NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS banner_rounded        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS banner_show_text      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS banner_button_text    TEXT,
  ADD COLUMN IF NOT EXISTS banner_button_link    TEXT;

ALTER TABLE public.catalog_settings
  DROP CONSTRAINT IF EXISTS catalog_settings_banner_height_check;
ALTER TABLE public.catalog_settings
  ADD CONSTRAINT catalog_settings_banner_height_check
  CHECK (banner_height IN ('sm', 'md', 'lg'));

ALTER TABLE public.catalog_settings
  DROP CONSTRAINT IF EXISTS catalog_settings_banner_image_position_check;
ALTER TABLE public.catalog_settings
  ADD CONSTRAINT catalog_settings_banner_image_position_check
  CHECK (banner_image_position IN ('left', 'center', 'right'));

-- ── Aparência da loja (fundo de toda a vitrine) ───────────────
ALTER TABLE public.catalog_settings
  ADD COLUMN IF NOT EXISTS background_type       TEXT NOT NULL DEFAULT 'theme',
  ADD COLUMN IF NOT EXISTS background_theme      TEXT NOT NULL DEFAULT 'neutro',
  ADD COLUMN IF NOT EXISTS background_color      TEXT,
  ADD COLUMN IF NOT EXISTS background_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS background_image_size     TEXT NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS background_image_position TEXT NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS background_overlay_opacity NUMERIC NOT NULL DEFAULT 0.35;

ALTER TABLE public.catalog_settings
  DROP CONSTRAINT IF EXISTS catalog_settings_background_type_check;
ALTER TABLE public.catalog_settings
  ADD CONSTRAINT catalog_settings_background_type_check
  CHECK (background_type IN ('theme', 'image', 'color'));

ALTER TABLE public.catalog_settings
  DROP CONSTRAINT IF EXISTS catalog_settings_background_theme_check;
ALTER TABLE public.catalog_settings
  ADD CONSTRAINT catalog_settings_background_theme_check
  CHECK (background_theme IN ('neutro', 'elegante', 'minimalista', 'floral', 'delicado', 'moderno', 'luxo', 'artesanal'));

ALTER TABLE public.catalog_settings
  DROP CONSTRAINT IF EXISTS catalog_settings_background_image_size_check;
ALTER TABLE public.catalog_settings
  ADD CONSTRAINT catalog_settings_background_image_size_check
  CHECK (background_image_size IN ('cover', 'repeat', 'contain'));

ALTER TABLE public.catalog_settings
  DROP CONSTRAINT IF EXISTS catalog_settings_background_overlay_opacity_check;
ALTER TABLE public.catalog_settings
  ADD CONSTRAINT catalog_settings_background_overlay_opacity_check
  CHECK (background_overlay_opacity >= 0 AND background_overlay_opacity <= 1);

COMMENT ON COLUMN public.catalog_settings.banner_height IS 'Altura do banner principal: sm | md | lg';
COMMENT ON COLUMN public.catalog_settings.banner_image_position IS 'Posicionamento da imagem do banner: left | center | right';
COMMENT ON COLUMN public.catalog_settings.banner_rounded IS 'true = caixa com cantos arredondados; false = banner ocupa toda a largura';
COMMENT ON COLUMN public.catalog_settings.banner_show_text IS 'Exibir nome/descrição/badges sobre o banner (false = só a imagem)';
COMMENT ON COLUMN public.catalog_settings.background_type IS 'Fonte do fundo da loja: theme (tema pronto) | image (upload) | color (cor sólida)';
COMMENT ON COLUMN public.catalog_settings.background_theme IS 'Tema pronto aplicado quando background_type = theme';
COMMENT ON COLUMN public.catalog_settings.background_overlay_opacity IS 'Opacidade (0-1) da camada de sobreposição sobre a imagem de fundo, para legibilidade';
