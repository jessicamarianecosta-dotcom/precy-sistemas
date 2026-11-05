-- ============================================================
-- PRECY+ — Migration 093: Paleta completa da loja (catalog_settings.theme_palette)
-- ============================================================
-- Evolui a identidade visual da loja pública de 1 cor (theme_color) para uma
-- paleta completa claro/escuro, sem criar configuração de aparência paralela:
-- catalog_settings continua sendo a única fonte de verdade.
--
-- theme_color é mantido (não removido) como campo derivado/legado, sincronizado
-- pela aplicação a cada salvamento (= theme_palette.light.primary), para não
-- quebrar nada que ainda leia só essa coluna (ex: StorePreviewCard).
-- ============================================================

ALTER TABLE public.catalog_settings
  ADD COLUMN IF NOT EXISTS theme_palette JSONB;

-- ── Geração de paleta default a partir de theme_color (mistura simples com
--    branco/preto), usada só no backfill abaixo. Mantida como função utilitária
--    reaproveitável; a ferramenta de edição usa a mesma lógica em TypeScript
--    (lib/catalog/theme/palette.ts) para o preview em tempo real.
CREATE OR REPLACE FUNCTION public.catalog_mix_hex(base_hex TEXT, amount NUMERIC)
RETURNS TEXT AS $$
DECLARE
  r INT; g INT; b INT; target INT; a NUMERIC;
BEGIN
  r := ('x' || substr(base_hex, 2, 2))::bit(8)::int;
  g := ('x' || substr(base_hex, 4, 2))::bit(8)::int;
  b := ('x' || substr(base_hex, 6, 2))::bit(8)::int;
  target := CASE WHEN amount >= 0 THEN 255 ELSE 0 END;
  a := abs(amount);
  r := round(r + (target - r) * a);
  g := round(g + (target - g) * a);
  b := round(b + (target - b) * a);
  RETURN '#' || lpad(to_hex(greatest(0, least(255, r))), 2, '0')
             || lpad(to_hex(greatest(0, least(255, g))), 2, '0')
             || lpad(to_hex(greatest(0, least(255, b))), 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.catalog_generate_default_palette(base_hex TEXT)
RETURNS JSONB AS $$
DECLARE
  luminance NUMERIC;
  r INT; g INT; b INT;
  light_button_text TEXT;
  dark_button_text TEXT;
  light_primary TEXT := upper(base_hex);
  dark_primary TEXT := public.catalog_mix_hex(base_hex, 0.18);
BEGIN
  r := ('x' || substr(base_hex, 2, 2))::bit(8)::int;
  g := ('x' || substr(base_hex, 4, 2))::bit(8)::int;
  b := ('x' || substr(base_hex, 6, 2))::bit(8)::int;
  luminance := (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  light_button_text := CASE WHEN luminance > 0.6 THEN '#1C1C1C' ELSE '#FFFFFF' END;
  dark_button_text := light_button_text;

  RETURN jsonb_build_object(
    'light', jsonb_build_object(
      'primary', light_primary,
      'secondary', public.catalog_mix_hex(base_hex, -0.2),
      'accent', public.catalog_mix_hex(base_hex, 0.3),
      'background', '#FFFFFF',
      'surface', '#F7F5F2',
      'text', '#1C1C1C',
      'textSecondary', '#6B6B6B',
      'border', '#E5E1DB',
      'buttonText', light_button_text
    ),
    'dark', jsonb_build_object(
      'primary', dark_primary,
      'secondary', upper(base_hex),
      'accent', public.catalog_mix_hex(base_hex, 0.35),
      'background', '#1C1C1C',
      'surface', '#262220',
      'text', '#F5F5F4',
      'textSecondary', '#A8A29E',
      'border', '#3A332C',
      'buttonText', dark_button_text
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill: lojas que só têm theme_color hoje (ex: lumilife, criativa-personalizados)
-- recebem uma paleta default derivada, para o visual não quebrar no deploy.
UPDATE public.catalog_settings
SET theme_palette = public.catalog_generate_default_palette(COALESCE(theme_color, '#8B6C4F'))
WHERE theme_palette IS NULL;
