-- ============================================================
-- PRECY+ — Migration 078: Arquivos de arte por item de orçamento (budget_item_files)
-- ============================================================
-- Mesmo padrão de 054_order_files.sql (arte de pedido), mas vinculado ao
-- ITEM do orçamento (budget_items), não só ao orçamento como um todo —
-- um orçamento pode ter vários produtos, cada um com sua própria arte.
-- Reutiliza o bucket "order-files" já existente (mesmas validações de
-- extensão/tamanho, mesmo padrão de política de storage: primeiro segmento
-- do path = company_id), sem criar bucket novo.
-- ============================================================

CREATE TABLE public.budget_item_files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_item_id  UUID NOT NULL REFERENCES public.budget_items(id) ON DELETE CASCADE,
  budget_id       UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_size       BIGINT NOT NULL DEFAULT 0,
  mime_type       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_item_files_budget_item_id ON public.budget_item_files(budget_item_id);
CREATE INDEX idx_budget_item_files_budget_id ON public.budget_item_files(budget_id);

CREATE TRIGGER set_updated_at_budget_item_files
  BEFORE UPDATE ON public.budget_item_files
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS: mesmo padrão tenant-scoped de order_files ──
ALTER TABLE public.budget_item_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_item_files_tenant" ON public.budget_item_files FOR ALL
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Nenhuma alteração de bucket/política de storage é necessária: as políticas
-- de storage.objects criadas em 054_order_files.sql já liberam qualquer path
-- dentro do bucket "order-files" cujo primeiro segmento seja o company_id do
-- usuário autenticado — o path usado aqui é
-- "{companyId}/budgets/{budgetId}/{budgetItemId}/{uuid}.{ext}", que já se
-- encaixa nessa regra.
