-- ============================================================
-- PRECY+ — Migration 046: Bucket catalog-photos (Catálogo Online)
-- ============================================================
-- Bucket dedicado para fotos de produtos do Catálogo Online, diferente
-- do "company-assets" genérico: aqui a escrita é restrita ao dono da
-- empresa via path (catalog-photos/<company_id>/<product_id>/<arquivo>),
-- já que o "company-assets" atual não é scoped por empresa.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-photos', 'catalog-photos', true, 4194304,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "catalog_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "catalog_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "catalog_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "catalog_photos_delete" ON storage.objects;

-- Leitura pública (a loja é acessada por visitantes anônimos)
CREATE POLICY "catalog_photos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-photos');

-- Escrita restrita ao dono: primeiro segmento do path = company_id do usuário
CREATE POLICY "catalog_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-photos'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "catalog_photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'catalog-photos'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "catalog_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'catalog-photos'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );
