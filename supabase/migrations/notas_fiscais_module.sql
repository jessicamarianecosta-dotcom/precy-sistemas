-- ==============================
-- Módulo "Notas Fiscais" (beta privado — ver lib/notasFiscais/betaAccess.ts).
--
-- Duas tabelas novas:
--   - bling_connections: uma conexão OAuth por empresa com o Bling,
--     mesmo desenho de mercadopago_connections (migration 090, aplicada
--     direto no banco — não existe no repo ainda): tokens cifrados
--     (AES-256-GCM, ver lib/notasFiscais/crypto.ts), refresh automático.
--   - fiscal_invoices: uma nota fiscal (hoje só NF-e — invoice_type fica
--     gravado para permitir NFC-e/NFS-e no futuro, sem migração nova)
--     por pedido. Índice único parcial em order_id para as notas ainda
--     "vivas" evita duas notas ativas pro mesmo pedido (prevenção de
--     duplicidade pedida no escopo do módulo).
--
-- RLS: isolamento por empresa de novo (mesma company_id = get_user_company_id()
-- de sempre). O corte "só a usuária X no beta" NÃO mora aqui — mora em
-- lib/notasFiscais/betaAccess.ts + middleware.ts + requireNotasFiscaisAccess(),
-- igual ao Catálogo Online (canAccessCatalog): é uma trava de produto/feature
-- flag, não de dados, então nunca devolveria risco de outra empresa ver a
-- nota de alguém mesmo sem ela — só decide se a FEATURE aparece/funciona.
-- ==============================

-- Campos fiscais que faltam no cadastro da empresa para ser o EMITENTE de
-- uma NF-e (CNPJ e endereço já existem). Nullable: empresa só precisa
-- preencher quando for de fato emitir.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS regime_tributario  TEXT
    CHECK (regime_tributario IS NULL OR regime_tributario IN ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'));

-- NCM e CFOP por produto — exigidos pela SEFAZ por item da nota, não
-- existiam no cadastro de produto (que é focado em precificação). Nullable:
-- produto continua funcionando normal em Pedidos/Precificação sem eles;
-- a tela de revisão da nota em Notas Fiscais que aponta "faltando".
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ncm  TEXT,
  ADD COLUMN IF NOT EXISTS cfop TEXT;

CREATE TABLE IF NOT EXISTS public.bling_connections (
  id                       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id               UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,

  bling_user_id             TEXT,            -- id numérico da conta Bling conectada
  bling_company_name        TEXT,            -- nome da empresa no Bling, só exibição

  access_token_encrypted    TEXT NOT NULL,
  refresh_token_encrypted   TEXT,
  token_expires_at          TIMESTAMPTZ,
  scopes                    TEXT,

  status                    TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_error                TEXT,

  connected_at              TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at           TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bling_connections_company_id_key'
  ) THEN
    ALTER TABLE public.bling_connections ADD CONSTRAINT bling_connections_company_id_key UNIQUE (company_id);
  END IF;
END $$;

ALTER TABLE public.bling_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bling_connections_tenant" ON public.bling_connections;
CREATE POLICY "bling_connections_tenant" ON public.bling_connections FOR ALL
  USING      (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP TRIGGER IF EXISTS set_updated_at_bling_connections ON public.bling_connections;
CREATE TRIGGER set_updated_at_bling_connections
  BEFORE UPDATE ON public.bling_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.fiscal_invoices (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id        UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id          UUID REFERENCES public.orders(id)    ON DELETE CASCADE NOT NULL,
  customer_id       UUID REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Hoje só 'nfe' está implementado (lib/notasFiscais) — nota de produto,
  -- que é o que a Precy+ vende (itens produzidos/personalizados, não
  -- serviço). NFC-e/NFS-e ficam de fora deste beta (ver documentação).
  invoice_type      TEXT NOT NULL DEFAULT 'nfe' CHECK (invoice_type IN ('nfe')),

  -- status interno (nosso controle de fluxo) e bling_status (string crua
  -- devolvida pela API do Bling) são campos separados de propósito: a doc
  -- oficial não confirmou o enum exato de status da v3 nesta sessão (ver
  -- lib/notasFiscais/README.md), então nunca presumimos tradução — só
  -- mostramos o texto que o Bling mandou, ao lado do nosso status de
  -- fluxo interno.
  status            TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'enviando', 'processando', 'autorizada', 'rejeitada', 'cancelada', 'erro')),
  bling_status      TEXT,

  bling_invoice_id  TEXT,          -- id do recurso /nfe no Bling, uma vez criado
  bling_number      TEXT,
  bling_series      TEXT,
  access_key        TEXT,          -- chave de acesso (44 dígitos), só depois de autorizada
  danfe_url         TEXT,
  xml_url           TEXT,

  natureza_operacao TEXT,

  request_payload   JSONB,         -- o que mandamos pro Bling (auditoria/debug — nunca token)
  last_response     JSONB,         -- última resposta crua do Bling (auditoria/debug)
  error_message     TEXT,

  created_by        UUID,
  sent_at            TIMESTAMPTZ,  -- quando o clique explícito de "enviar à SEFAZ" aconteceu
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at       TIMESTAMPTZ
);

-- Prevenção de duplicidade: só pode haver UMA nota "viva" por pedido —
-- se a nota anterior foi cancelada ou terminou em erro, pode tentar de
-- novo (nova linha); se já existe rascunho/enviando/processando/autorizada,
-- a rota de criação (app/api/notas-fiscais/[orderId]/criar) devolve a
-- existente em vez de criar outra.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_invoices_order_active
  ON public.fiscal_invoices (order_id)
  WHERE status NOT IN ('cancelada', 'erro');

ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_invoices_tenant" ON public.fiscal_invoices;
CREATE POLICY "fiscal_invoices_tenant" ON public.fiscal_invoices FOR ALL
  USING      (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_company_status ON public.fiscal_invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_order           ON public.fiscal_invoices(order_id);

DROP TRIGGER IF EXISTS set_updated_at_fiscal_invoices ON public.fiscal_invoices;
CREATE TRIGGER set_updated_at_fiscal_invoices
  BEFORE UPDATE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
