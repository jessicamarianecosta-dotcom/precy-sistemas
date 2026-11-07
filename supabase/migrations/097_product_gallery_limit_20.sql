-- ============================================================
-- PRECY+ — Migration 097: Galeria principal de 10 para 20 fotos
-- ============================================================
-- Produtos com muitas variações visuais (ex: coleções com dezenas de
-- miniaturas de página, acabamentos etc.) precisavam de mais espaço na
-- galeria principal do que as 10 fotos da migration 086. Mantém a mesma
-- lógica (contagem separada por gallery_visible, migration 096), só sobe
-- o teto da galeria visível de 10 para 20 — o limite de imagens de opção
-- de variação (gallery_visible = false) continua em 60, inalterado.
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
    IF v_count >= 20 THEN
      RAISE EXCEPTION 'Limite de 20 fotos na galeria principal do produto atingido';
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
