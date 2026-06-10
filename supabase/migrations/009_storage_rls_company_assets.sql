-- ============================================================
-- PRECY+ — Migration 009: Storage RLS para company-assets
-- Execute no SQL Editor do painel Supabase:
-- app.supabase.com → SQL Editor → New Query → Run
-- ============================================================

-- 1. Bucket (caso não exista)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets', 'company-assets', true, 2097152,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Remover policies antigas
DROP POLICY IF EXISTS "company_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "company_assets_delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Logo is public" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own logos" ON storage.objects;

-- 3. Criar policies corretas
CREATE POLICY "company_assets_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "company_assets_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-assets');
