-- ============================================================
-- PRECY+ — Migration 086: Galeria de mídia dos produtos (até 10
-- fotos + 1 vídeo de até 20s)
-- ============================================================
-- Amplia a tabela normalizada já existente (product_images, migration 051)
-- em vez de criar uma tabela nova: ela já guarda produto/empresa/url/ordem
-- por linha, e já tem leitura pública + RLS por empresa prontas.
--
-- Novas colunas:
--   media_type       'image' | 'video'   — default 'image' (preserva as 22 linhas existentes)
--   is_primary       foto de capa (vídeo nunca é capa)
--   mime_type        tipo MIME real detectado no servidor (não a extensão)
--   file_size        bytes
--   duration_seconds duração do vídeo (NULL para imagens)
--   storage_path     caminho dentro do bucket catalog-photos — permite apagar
--                     o arquivo do Storage ao remover a linha sem precisar
--                     re-derivar o path a partir da URL pública
-- ============================================================

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS media_type        TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS is_primary        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mime_type         TEXT,
  ADD COLUMN IF NOT EXISTS file_size         BIGINT,
  ADD COLUMN IF NOT EXISTS duration_seconds  NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS storage_path      TEXT;

-- Backfill: a capa de cada produto já era a linha de sort_order mínimo
-- (convenção usada pelo app desde a migration 051) — marca ela como
-- is_primary explicitamente, sem mudar nenhuma URL/ordem existente.
WITH covers AS (
  SELECT DISTINCT ON (product_id) id
  FROM public.product_images
  ORDER BY product_id, sort_order ASC
)
UPDATE public.product_images pi
SET is_primary = true
FROM covers
WHERE pi.id = covers.id;

-- Vídeo nunca é capa — defesa em profundidade, além da UI.
CREATE OR REPLACE FUNCTION public.check_product_video_not_primary()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.media_type = 'video' AND NEW.is_primary THEN
    RAISE EXCEPTION 'Vídeo não pode ser definido como foto principal';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_product_video_not_primary ON public.product_images;
CREATE TRIGGER trg_check_product_video_not_primary
  BEFORE INSERT OR UPDATE ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.check_product_video_not_primary();

-- Só uma foto principal por produto: ao marcar uma como is_primary, desmarca
-- as outras do mesmo produto automaticamente (evita round-trip de 2 updates
-- do client ter que acertar isso manualmente, e protege contra inconsistência
-- se algum caminho futuro esquecer de desmarcar a anterior).
CREATE OR REPLACE FUNCTION public.enforce_single_primary_product_image()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.product_images
    SET is_primary = false
    WHERE product_id = NEW.product_id AND id <> NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_primary_product_image ON public.product_images;
CREATE TRIGGER trg_enforce_single_primary_product_image
  AFTER INSERT OR UPDATE ON public.product_images
  FOR EACH ROW WHEN (NEW.is_primary) EXECUTE FUNCTION public.enforce_single_primary_product_image();

-- Substitui o limite antigo (4 fotos) por 10 fotos + 1 vídeo por produto.
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
  ELSE
    SELECT COUNT(*) INTO v_count FROM public.product_images
      WHERE product_id = NEW.product_id AND media_type = 'image';
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Limite de 10 fotos por produto atingido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- (trigger trg_check_product_images_limit já existe desde a migration 051 e
-- continua apontando pra esta função — só o corpo mudou)

COMMENT ON COLUMN public.product_images.media_type IS 'image ou video — vídeo limitado a 1 por produto e máx. 20s (validado na API de upload).';
COMMENT ON COLUMN public.product_images.storage_path IS 'Caminho do arquivo no bucket catalog-photos, usado para apagar do Storage ao remover a linha.';
