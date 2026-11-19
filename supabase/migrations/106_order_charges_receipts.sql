-- ==============================
-- Cobrança (PDF + link público) e recibo (link público) para pedidos
-- no módulo Financeiro.
--
-- Mesmo padrão já usado em 102_budget_public_sharing.sql: token opaco
-- não sequencial, acesso público sempre via rota server-side com
-- service role (nunca RLS anônima), e nenhum pagamento é marcado como
-- confirmado automaticamente — isso continua exigindo o registro manual
-- de recebimento (register_order_payment), já existente.
--
-- `order_charges` é só a intenção/solicitação de cobrança (valor pedido
-- + vencimento + snapshot do Pix no momento da criação). Ela NUNCA
-- grava em financial_transactions/payment_history — isso só acontece
-- quando o recebimento é de fato registrado pelo fluxo já existente.
-- O saldo exibido na cobrança é sempre recalculado ao vivo a partir de
-- orders.total - soma(payment_history), nunca congelado, para refletir
-- pagamentos parciais corretamente sem duplicar nenhum lançamento.
-- ==============================

CREATE TABLE IF NOT EXISTS public.order_charges (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id    UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id      UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Valor e vencimento solicitados no momento da criação. Na exibição
  -- (painel e link público) o valor é sempre limitado ao saldo real
  -- ainda em aberto do pedido (nunca mostra mais do que o cliente
  -- realmente deve).
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date      DATE NOT NULL,
  notes         TEXT,

  -- Snapshot do Pix da empresa no momento da criação (sempre a chave
  -- CNPJ — ver lib/orders/chargePix.ts), para não mudar o conteúdo de
  -- uma cobrança já emitida se a empresa trocar o CNPJ/endereço depois.
  pix_type      TEXT,
  pix_key       TEXT,
  pix_label     TEXT,
  pix_txid      TEXT,

  status        TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),

  public_token  UUID NOT NULL DEFAULT uuid_generate_v4(),

  sent_at           TIMESTAMPTZ,
  first_viewed_at   TIMESTAMPTZ,
  last_viewed_at    TIMESTAMPTZ,
  view_count        INTEGER NOT NULL DEFAULT 0,

  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at  TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_charges_public_token_key'
  ) THEN
    ALTER TABLE public.order_charges ADD CONSTRAINT order_charges_public_token_key UNIQUE (public_token);
  END IF;
END $$;

ALTER TABLE public.order_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_charges_tenant" ON public.order_charges;
CREATE POLICY "order_charges_tenant" ON public.order_charges FOR ALL
  USING      (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_order_charges_order           ON public.order_charges(order_id);
CREATE INDEX IF NOT EXISTS idx_order_charges_company_status  ON public.order_charges(company_id, status);
CREATE INDEX IF NOT EXISTS idx_order_charges_public_token    ON public.order_charges(public_token);

DROP TRIGGER IF EXISTS set_updated_at_order_charges ON public.order_charges;
CREATE TRIGGER set_updated_at_order_charges
  BEFORE UPDATE ON public.order_charges
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================
-- Recibo: reaproveita payment_history (nenhuma tabela nova) — cada
-- recebimento já registrado passa a ter um token opaco próprio, para
-- poder ser aberto/baixado por um link público sem expor o id
-- sequencial nem exigir login do cliente.
-- ==============================
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT uuid_generate_v4();

UPDATE public.payment_history SET public_token = uuid_generate_v4() WHERE public_token IS NULL;

ALTER TABLE public.payment_history
  ALTER COLUMN public_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_history_public_token_key'
  ) THEN
    ALTER TABLE public.payment_history ADD CONSTRAINT payment_history_public_token_key UNIQUE (public_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_history_public_token ON public.payment_history(public_token);
