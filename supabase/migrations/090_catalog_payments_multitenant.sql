-- ============================================================
-- PRECY+ — Migration 090: Pagamentos do Catálogo Online (multi-tenant)
-- ============================================================
-- Fundação multi-tenant para receber pagamentos de clientes finais no
-- Catálogo Online, por loja (company_id), começando pelo Mercado Pago.
--
-- Não confundir com a assinatura do Precy (Stripe) — essa migration não
-- toca em nenhuma tabela/coluna do Stripe nem na rota de assinatura.
--
-- Tabelas novas:
--   • store_payment_settings  — configuração de pagamento por loja (1:1)
--   • store_payment_accounts  — conta conectada no gateway (OAuth), tokens
--                                 criptografados, nunca expostos ao client
--   • payment_fee_rules       — tabela de taxas (global e/ou por loja),
--                                 fonte única de verdade para o cálculo de
--                                 preço bruto — nunca inventada no código
--   • payments                — um registro por cobrança criada no gateway
--                                 (detalhe técnico: Pix/cartão, parcelas,
--                                 QR code, status) — complementa
--                                 payment_history (camada contábil, já
--                                 existente, inalterada)
--   • payment_webhook_events  — idempotência e auditoria de notificações
--   • payment_refunds         — reembolsos solicitados pela loja
--
-- orders: colunas de snapshot do pagamento (forma, parcelas, taxa, valor
-- líquido) — preservam exatamente o que foi cobrado mesmo que a
-- configuração de taxas mude depois.
--
-- Não apaga nem recria nada existente — apenas cria/adiciona.
-- ============================================================

-- ── store_payment_settings (1:1 por empresa) ────────────────
CREATE TABLE IF NOT EXISTS public.store_payment_settings (
  company_id            UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago')),
  pix_enabled           BOOLEAN NOT NULL DEFAULT true,
  card_enabled          BOOLEAN NOT NULL DEFAULT false,
  card_max_installments SMALLINT NOT NULL DEFAULT 1 CHECK (card_max_installments BETWEEN 1 AND 3),
  -- 'pass_to_customer': acréscimo do cartão é somado ao preço (preço cadastrado = preço no Pix).
  -- 'absorb': a loja assume o custo — cliente paga o mesmo valor em qualquer forma de pagamento.
  surcharge_mode        TEXT NOT NULL DEFAULT 'pass_to_customer' CHECK (surcharge_mode IN ('pass_to_customer', 'absorb')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.store_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_payment_settings_tenant" ON public.store_payment_settings;
CREATE POLICY "store_payment_settings_tenant" ON public.store_payment_settings FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP TRIGGER IF EXISTS trg_store_payment_settings_updated_at ON public.store_payment_settings;
CREATE TRIGGER trg_store_payment_settings_updated_at
  BEFORE UPDATE ON public.store_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── store_payment_accounts (conta conectada via OAuth) ──────
-- Sem políticas para anon/authenticated: só a service role (rotas de
-- backend) lê/grava esta tabela — tokens nunca passam pelo client, nem
-- para o próprio lojista autenticado. Status de conexão é exposto por uma
-- rota dedicada (/api/loja/pagamentos/mercadopago/status) que nunca
-- devolve as colunas de token.
CREATE TABLE IF NOT EXISTS public.store_payment_accounts (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id              UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  provider                TEXT NOT NULL DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago')),
  provider_user_id        TEXT,
  public_key              TEXT,
  access_token_encrypted  TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at        TIMESTAMPTZ,
  scope                   TEXT,
  live_mode               BOOLEAN NOT NULL DEFAULT false,
  status                  TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_error              TEXT,
  connected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, provider)
);

ALTER TABLE public.store_payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_store_payment_accounts_company ON public.store_payment_accounts(company_id);

DROP TRIGGER IF EXISTS trg_store_payment_accounts_updated_at ON public.store_payment_accounts;
CREATE TRIGGER trg_store_payment_accounts_updated_at
  BEFORE UPDATE ON public.store_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── payment_fee_rules (fonte única das taxas — nunca inventadas) ──
-- company_id NULL = regra padrão da plataforma (fallback); uma linha com
-- company_id preenchido para o mesmo (provider, payment_method,
-- installments) sobrepõe a regra padrão para aquela loja.
CREATE TABLE IF NOT EXISTS public.payment_fee_rules (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id     UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
  installments   SMALLINT NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 3),
  fee_percent    NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (fee_percent >= 0 AND fee_percent < 1),
  fee_fixed      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee_fixed >= 0),
  notes          TEXT,
  updated_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unicidade tratando company_id NULL como um valor (duas regras globais
-- para o mesmo método/parcela não podem coexistir).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_fee_rules_unique
  ON public.payment_fee_rules (provider, payment_method, installments, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'));

ALTER TABLE public.payment_fee_rules ENABLE ROW LEVEL SECURITY;

-- Leitura: a loja vê as regras globais e as próprias (nunca as de outra loja).
DROP POLICY IF EXISTS "payment_fee_rules_read" ON public.payment_fee_rules;
CREATE POLICY "payment_fee_rules_read" ON public.payment_fee_rules FOR SELECT
  USING (company_id IS NULL OR company_id = public.get_user_company_id());

-- Sem política de escrita para authenticated/anon: criação/edição de taxa é
-- administrativa, feita via service role (nunca pelo lojista direto, para
-- não permitir que a própria loja reduza a taxa que aparece no checkout).
DROP TRIGGER IF EXISTS trg_payment_fee_rules_updated_at ON public.payment_fee_rules;
CREATE TRIGGER trg_payment_fee_rules_updated_at
  BEFORE UPDATE ON public.payment_fee_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Taxas padrão da plataforma (globais, company_id NULL) — valores de
-- referência documentados nas condições públicas do Mercado Pago (Checkout
-- Transparente / conta "Web"); ATUALIZAR aqui, via admin, com as condições
-- reais exibidas na conta Mercado Pago de cada loja quando ela conectar
-- (ver app/(dashboard)/admin — tela de taxas), pois variam por CNPJ/MCC/
-- volume e o Mercado Pago não garante a mesma tarifa para todas as contas.
INSERT INTO public.payment_fee_rules (company_id, provider, payment_method, installments, fee_percent, fee_fixed, notes)
VALUES
  (NULL, 'mercadopago', 'pix', 1, 0.0099, 0, 'Taxa padrão de referência — confirmar na conta conectada'),
  (NULL, 'mercadopago', 'credit_card', 1, 0.0499, 0, 'Taxa padrão de referência — confirmar na conta conectada'),
  (NULL, 'mercadopago', 'credit_card', 2, 0.0649, 0, 'Taxa padrão de referência — confirmar na conta conectada'),
  (NULL, 'mercadopago', 'credit_card', 3, 0.0749, 0, 'Taxa padrão de referência — confirmar na conta conectada')
ON CONFLICT DO NOTHING;

-- ── payments (detalhe técnico de cada cobrança no gateway) ──
CREATE TABLE IF NOT EXISTS public.payments (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id            UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id              UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  provider              TEXT NOT NULL DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago')),
  provider_payment_id   TEXT,
  checkout_ref          TEXT NOT NULL,
  payment_method        TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
  installments          SMALLINT NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'in_process', 'approved', 'rejected', 'cancelled', 'refunded', 'expired')),
  amount                NUMERIC(12,2) NOT NULL,          -- valor bruto cobrado do cliente
  net_amount            NUMERIC(12,2) NOT NULL,          -- valor líquido desejado pela loja (preço Pix)
  fee_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
  fee_percent_snapshot   NUMERIC(7,4) NOT NULL DEFAULT 0,
  fee_fixed_snapshot     NUMERIC(10,2) NOT NULL DEFAULT 0,
  pix_qr_code            TEXT,
  pix_qr_code_base64     TEXT,
  pix_expires_at         TIMESTAMPTZ,
  failure_reason         TEXT,
  raw_response           JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_payment_id)
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_tenant_read" ON public.payments;
CREATE POLICY "payments_tenant_read" ON public.payments FOR SELECT
  USING (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_payments_company ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_ref ON public.payments(checkout_ref);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── payment_webhook_events (idempotência + auditoria) ───────
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider            TEXT NOT NULL,
  provider_payment_id TEXT,
  resulting_status    TEXT,
  payload             JSONB,
  processing_status   TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored', 'error')),
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trava de idempotência real: a MESMA transição de status do MESMO
-- pagamento só é aplicada uma vez, mesmo que o gateway reenvie a notificação
-- (comum em timeout). Permite múltiplas linhas para o mesmo pagamento
-- quando o status evolui (pending → approved → refunded, por exemplo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_idempotency
  ON public.payment_webhook_events (provider, provider_payment_id, resulting_status)
  WHERE provider_payment_id IS NOT NULL AND resulting_status IS NOT NULL;

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
-- Sem política: só service role lê/grava (log técnico interno).

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_payment ON public.payment_webhook_events(provider, provider_payment_id);

-- ── payment_refunds ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  payment_id          UUID REFERENCES public.payments(id) ON DELETE CASCADE NOT NULL,
  order_id            UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  provider_refund_id  TEXT,
  amount              NUMERIC(12,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason              TEXT,
  requested_by        UUID REFERENCES auth.users(id),
  raw_response        JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_refunds_tenant_read" ON public.payment_refunds;
CREATE POLICY "payment_refunds_tenant_read" ON public.payment_refunds FOR SELECT
  USING (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_payment_refunds_company ON public.payment_refunds(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON public.payment_refunds(payment_id);

DROP TRIGGER IF EXISTS trg_payment_refunds_updated_at ON public.payment_refunds;
CREATE TRIGGER trg_payment_refunds_updated_at
  BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── orders: snapshot do pagamento (nunca recalculado depois) ──
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider       TEXT,
  ADD COLUMN IF NOT EXISTS payment_method         TEXT CHECK (payment_method IN ('pix', 'credit_card')),
  ADD COLUMN IF NOT EXISTS installments           SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS net_amount             NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fee_amount             NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fee_percent_snapshot   NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS fee_fixed_snapshot     NUMERIC(10,2);

COMMENT ON COLUMN public.orders.net_amount IS 'Valor líquido desejado pela loja no momento da compra (preço no Pix) — snapshot, não recalculado se as taxas mudarem depois.';
COMMENT ON COLUMN public.orders.fee_amount IS 'Diferença entre orders.total (cobrado do cliente) e net_amount — snapshot da taxa repassada, se houver.';
