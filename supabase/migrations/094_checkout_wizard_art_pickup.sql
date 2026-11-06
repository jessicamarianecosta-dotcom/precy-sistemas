-- ============================================================
-- PRECY+ — Migration 094: Checkout em etapas — arte por item, retirada local
-- ============================================================
-- Suporte à reformulação do checkout da loja online (Cadastro / Produto e
-- Arte / Entrega / Pagamento). Tudo aditivo e compatível com pedidos
-- antigos: nenhuma coluna existente é removida ou tem seu significado
-- alterado, e os novos campos são opcionais (NULL = comportamento anterior).
--
-- Reaproveita a estrutura já existente em vez de duplicar:
--   - order_files (migration 054) ganha order_item_id/file_role/proposal_number
--     em vez de uma tabela nova de "propostas de arte".
--   - orders.art_status (migration 054) é estendido com os estados do fluxo
--     de propostas/aprovação, continuando como o único enum de status de arte.
-- ============================================================

-- ── Entrega: transportadora ou retirada no local ────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method TEXT,
  ADD COLUMN IF NOT EXISTS pickup_choice TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_method_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_fulfillment_method_check
      CHECK (fulfillment_method IS NULL OR fulfillment_method IN ('shipping', 'pickup'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_pickup_choice_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_pickup_choice_check
      CHECK (pickup_choice IS NULL OR pickup_choice IN ('self', 'uber_flash'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.fulfillment_method IS 'Como o pedido do catálogo é entregue: shipping (transportadora/SuperFrete) ou pickup (retirada no local, grátis).';
COMMENT ON COLUMN public.orders.pickup_choice IS 'Quando fulfillment_method = pickup: self (cliente retira pessoalmente) ou uber_flash (cliente envia um entregador).';

-- ── Arte: estende art_status com o fluxo de propostas/aprovação ────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_art_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_art_status_check
  CHECK (art_status IN (
    'nao_enviada',
    'recebida',
    'em_analise',
    'propostas_enviadas',
    'aguardando_escolha_cliente',
    'necessita_correcao',
    'aguardando_novo_arquivo',
    'aguardando_autorizacao_extra',
    'aprovada',
    'em_producao'
  ));

-- ── order_items: origem da arte e controle de alterações gratuitas (por item,
--    nunca misturando produtos diferentes do mesmo pedido) ──────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS art_origin TEXT,
  ADD COLUMN IF NOT EXISTS art_brief JSONB,
  ADD COLUMN IF NOT EXISTS art_approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS chosen_proposal_file_id UUID,
  ADD COLUMN IF NOT EXISTS art_free_revisions_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS art_free_revisions_limit INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS art_extra_change_price NUMERIC,
  ADD COLUMN IF NOT EXISTS art_extra_change_authorized BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_art_origin_check') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_art_origin_check
      CHECK (art_origin IS NULL OR art_origin IN ('own', 'lumilife'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_art_approval_status_check') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_art_approval_status_check
      CHECK (art_approval_status IN (
        'pending', 'in_review', 'proposals_sent', 'awaiting_choice',
        'revision_requested', 'awaiting_extra_authorization', 'approved'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.order_items.art_origin IS 'Origem da arte deste item: own (cliente já tem a arte) ou lumilife (equipe cria). NULL para itens sem personalização de arte.';
COMMENT ON COLUMN public.order_items.art_brief IS 'Briefing de criação quando art_origin = lumilife: { text, colors, style, description }. Arquivos de referência ficam em order_files (file_role=referencia).';
COMMENT ON COLUMN public.order_items.art_free_revisions_limit IS 'Alterações gratuitas na PROPOSTA ESCOLHIDA (padrão 3) — não é por proposta individual.';

-- ── order_files: vincular cada arquivo a um item específico (isolando arte
--    entre produtos diferentes do mesmo pedido) e qualificar seu papel ────
ALTER TABLE public.order_files
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_role TEXT NOT NULL DEFAULT 'cliente_arte',
  ADD COLUMN IF NOT EXISTS proposal_number SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_files_file_role_check') THEN
    ALTER TABLE public.order_files
      ADD CONSTRAINT order_files_file_role_check
      CHECK (file_role IN ('cliente_arte', 'referencia', 'proposta', 'versao_final'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_files_proposal_number_check') THEN
    ALTER TABLE public.order_files
      ADD CONSTRAINT order_files_proposal_number_check
      CHECK (proposal_number IS NULL OR proposal_number BETWEEN 1 AND 3);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS order_files_order_item_id_idx ON public.order_files(order_item_id);

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_chosen_proposal_file_id_fkey
  FOREIGN KEY (chosen_proposal_file_id) REFERENCES public.order_files(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.order_files.order_item_id IS 'Item do pedido a que este arquivo pertence — isola arquivos entre produtos diferentes do mesmo pedido. NULL em arquivos antigos (upload único por pedido).';
COMMENT ON COLUMN public.order_files.file_role IS 'cliente_arte (enviado pelo cliente), referencia (ex. visual para a equipe criar), proposta (modelo enviado pela equipe), versao_final (após aprovação).';
