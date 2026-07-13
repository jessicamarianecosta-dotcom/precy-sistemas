-- ============================================================
-- PRECY+ — Migration 052: Backfill de products.catalog_photos → product_images
-- ============================================================
-- A partir desta versão, product_images é a fonte de verdade para fotos de
-- produto. A coluna catalog_photos (JSONB) é mantida por compatibilidade
-- (fallback de leitura em código legado / importação da Biblioteca Precy+),
-- mas deixa de ser escrita por qualquer fluxo novo.
-- ============================================================

INSERT INTO public.product_images (product_id, company_id, url, sort_order)
SELECT
  p.id,
  p.company_id,
  photo.value #>> '{}',
  (photo.ordinality - 1)::INT
FROM public.products p,
     jsonb_array_elements(p.catalog_photos) WITH ORDINALITY AS photo(value, ordinality)
WHERE jsonb_array_length(p.catalog_photos) > 0
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

COMMENT ON COLUMN public.products.catalog_photos IS
  'DEPRECATED (migration 052): fonte de verdade agora é product_images. Mantida como fallback de leitura, não escrever aqui em código novo.';
