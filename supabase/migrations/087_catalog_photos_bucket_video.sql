-- ============================================================
-- PRECY+ — Migration 087: bucket catalog-photos aceita vídeo
-- ============================================================
-- O bucket (migration 046) só aceitava imagens e tinha file_size_limit de
-- 4MiB — na verdade MENOR que o limite de 10MB que a própria rota de upload
-- já aplicava para fotos de produto (o Storage rejeitava silenciosamente
-- qualquer foto entre 4MB e 10MB antes de chegar nessa checagem). Ajustado
-- para 25MB, suficiente para um vídeo de até 20s em qualidade razoável, e
-- adicionado video/mp4 aos tipos aceitos.
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 26214400, -- 25MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4']
WHERE id = 'catalog-photos';
