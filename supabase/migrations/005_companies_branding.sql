-- ============================================================
-- PRECY+ — Migration 005: Branding columns em companies
-- ============================================================
-- Execute no SQL Editor do painel Supabase:
-- https://app.supabase.com → SQL Editor → New Query → Paste → Run
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS primary_color   TEXT DEFAULT '#8B6C4F',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#2C2018',
  ADD COLUMN IF NOT EXISTS logo_url        TEXT;

-- Bucket company-assets (execute separado se der erro de permissão):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('company-assets', 'company-assets', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Authenticated users can upload logos"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'company-assets' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "Logo is public"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'company-assets');
