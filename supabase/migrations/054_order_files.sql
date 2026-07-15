-- ============================================================
-- PRECY+ — Migration 054: Arquivos de arte do pedido (order_files)
-- ============================================================
-- Hoje a arte enviada pelo cliente no checkout da Loja vira só uma URL
-- dentro de orders.notes. Esta migration cria uma estrutura de verdade:
-- order_files (cada arquivo, com status de conferência individual) e
-- order_art_events (histórico de eventos da arte, nível do pedido) +
-- orders.art_status (status agregado da arte, independente de orders.status).
-- ============================================================

CREATE TABLE public.order_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_size     BIGINT NOT NULL DEFAULT 0,
  mime_type     TEXT,
  uploaded_by   TEXT NOT NULL DEFAULT 'cliente' CHECK (uploaded_by IN ('cliente', 'equipe')),
  status        TEXT NOT NULL DEFAULT 'nao_conferido'
                CHECK (status IN ('nao_conferido', 'conferido', 'aguardando_cliente', 'aprovado', 'necessita_alteracao')),
  review_notes  TEXT,
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.order_art_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

-- Status agregado da arte do pedido — nunca altera orders.status
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS art_status TEXT NOT NULL DEFAULT 'nao_enviada'
  CHECK (art_status IN ('nao_enviada', 'recebida', 'em_analise', 'necessita_correcao', 'aguardando_novo_arquivo', 'aprovada', 'em_producao'));

CREATE INDEX idx_order_files_order_id ON public.order_files(order_id);
CREATE INDEX idx_order_art_events_order_id ON public.order_art_events(order_id);

CREATE TRIGGER set_updated_at_order_files
  BEFORE UPDATE ON public.order_files
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS: mesmo padrão tenant-scoped de todas as tabelas do domínio ──
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_art_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_files_tenant" ON public.order_files FOR ALL
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "order_art_events_tenant" ON public.order_art_events FOR ALL
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- ============================================================
-- Storage: bucket dedicado "order-files"
-- ============================================================
-- Diferente de catalog-photos (só imagem, 4MB): arte de pedido inclui
-- PDF/AI/CDR/ZIP/RAR em arquivos maiores — sem allowlist de mime (.ai/.cdr
-- não têm mime_type padronizado entre navegadores), validação de
-- extensão/tamanho fica nas rotas de API. Limite de 50MB no bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('order-files', 'order-files', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800, allowed_mime_types = NULL;

DROP POLICY IF EXISTS "order_files_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "order_files_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "order_files_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "order_files_storage_delete" ON storage.objects;

CREATE POLICY "order_files_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-files');

CREATE POLICY "order_files_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order-files'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "order_files_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'order-files'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "order_files_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order-files'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );
