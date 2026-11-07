-- ============================================================
-- PRECY+ — Migration 096: Imagens de capa por opção de variação
-- ============================================================
-- Até aqui, product_images servia só pra galeria principal do produto
-- (até 10 fotos, migration 086) e product_variation_options.default_image_id
-- (migration 092) sempre escolhia uma dessas 10 fotos. Isso não é suficiente
-- pra um produto com uma variação "Capa" com 17 opções, cada uma com sua
-- própria foto — ou o limite de 10 impede cadastrar todas, ou elas entram
-- na galeria principal e poluem o carrossel de fotos do produto (que deve
-- mostrar só as fotos gerais, não uma foto por opção de capa).
--
-- `gallery_visible` resolve isso: imagens enviadas especificamente para uma
-- opção de variação (ex: cada uma das 17 capas) marcam gallery_visible =
-- false — continuam em product_images (mesma tabela, mesmas políticas,
-- reaproveitáveis em default_image_id/product_variants.image_id como
-- qualquer outra), só não aparecem na galeria/carrossel principal. O
-- gatilho de limite passa a contar os dois grupos separadamente: galeria
-- principal continua limitada a 10 (comportamento já existente,
-- inalterado); imagens fora da galeria (capas de variação) ganham um
-- limite bem mais generoso, suficiente para qualquer quantidade razoável
-- de opções cadastradas.
ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS gallery_visible BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.product_images.gallery_visible IS
  'false = imagem enviada para uma opção de variação (ex: capa), não aparece na galeria/carrossel principal do produto — só é usada via default_image_id / product_variants.image_id.';

CREATE OR REPLACE FUNCTION public.check_product_images_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.media_type = 'video' THEN
    SELECT COUNT(*) INTO v_count FROM public.product_images
      WHERE product_id = NEW.product_id AND media_type = 'video';
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'Limite de 1 vídeo por produto atingido';
    END IF;
  ELSIF NEW.gallery_visible THEN
    SELECT COUNT(*) INTO v_count FROM public.product_images
      WHERE product_id = NEW.product_id AND media_type = 'image' AND gallery_visible = true;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Limite de 10 fotos na galeria principal do produto atingido';
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_count FROM public.product_images
      WHERE product_id = NEW.product_id AND media_type = 'image' AND gallery_visible = false;
    IF v_count >= 60 THEN
      RAISE EXCEPTION 'Limite de 60 imagens de opções de variação atingido';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
