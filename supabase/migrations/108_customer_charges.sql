-- ==============================
-- Aviso de cobrança agregado por CLIENTE (soma de vários pedidos em
-- aberto), complementando 106_order_charges_receipts.sql (cobrança de
-- UM pedido).
--
-- Mesmo padrão: token opaco não sequencial, acesso público sempre via
-- rota server-side com service role (nunca RLS anônima), snapshot do
-- Pix congelado no momento da criação, e nenhum pagamento é marcado
-- como confirmado automaticamente — o recebimento continua sendo
-- registrado pedido a pedido pelo fluxo já existente
-- (register_order_payment). `customer_charges` nunca grava em
-- financial_transactions/payment_history.
--
-- `customer_charge_orders` guarda QUAIS pedidos entraram no aviso no
-- momento da criação (para exibir a discriminação por pedido mesmo se
-- um deles for pago depois) — o saldo exibido por pedido, e o total,
-- são sempre recalculados ao vivo a partir de orders.total -
-- soma(payment_history), igual à cobrança de pedido único.
-- ==============================

CREATE TABLE IF NOT EXISTS public.customer_charges (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id    UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,

  -- Soma dos saldos dos pedidos incluídos no momento da criação. Na
  -- exibição (painel e link público) o valor é sempre recalculado a
  -- partir do saldo real ainda em aberto de cada pedido incluído.
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date      DATE NOT NULL,
  notes         TEXT,

  -- Snapshot do Pix da empresa (Configurações › Dados de pagamento) no
  -- momento da criação — mesmo padrão de order_charges.
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
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_charges_public_token_key'
  ) THEN
    ALTER TABLE public.customer_charges ADD CONSTRAINT customer_charges_public_token_key UNIQUE (public_token);
  END IF;
END $$;

ALTER TABLE public.customer_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_charges_tenant" ON public.customer_charges;
CREATE POLICY "customer_charges_tenant" ON public.customer_charges FOR ALL
  USING      (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_customer_charges_customer       ON public.customer_charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_charges_company_status ON public.customer_charges(company_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_charges_public_token   ON public.customer_charges(public_token);

DROP TRIGGER IF EXISTS set_updated_at_customer_charges ON public.customer_charges;
CREATE TRIGGER set_updated_at_customer_charges
  BEFORE UPDATE ON public.customer_charges
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================
-- Pedidos incluídos em cada aviso de cobrança do cliente.
-- ==============================

CREATE TABLE IF NOT EXISTS public.customer_charge_orders (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_charge_id  UUID REFERENCES public.customer_charges(id) ON DELETE CASCADE NOT NULL,
  order_id            UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,

  -- Saldo do pedido no momento em que entrou neste aviso (referência/
  -- histórico — a exibição recalcula ao vivo, nunca usa este valor
  -- como fonte de verdade).
  balance_at_creation NUMERIC(12,2) NOT NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_charge_orders_unique'
  ) THEN
    ALTER TABLE public.customer_charge_orders
      ADD CONSTRAINT customer_charge_orders_unique UNIQUE (customer_charge_id, order_id);
  END IF;
END $$;

ALTER TABLE public.customer_charge_orders ENABLE ROW LEVEL SECURITY;

-- Mesma regra multi-tenant da cobrança-pai (join), evitando duplicar
-- company_id numa tabela puramente de ligação.
DROP POLICY IF EXISTS "customer_charge_orders_tenant" ON public.customer_charge_orders;
CREATE POLICY "customer_charge_orders_tenant" ON public.customer_charge_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_charges cc
      WHERE cc.id = customer_charge_orders.customer_charge_id
        AND cc.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_charges cc
      WHERE cc.id = customer_charge_orders.customer_charge_id
        AND cc.company_id = public.get_user_company_id()
    )
  );

CREATE INDEX IF NOT EXISTS idx_customer_charge_orders_charge ON public.customer_charge_orders(customer_charge_id);
CREATE INDEX IF NOT EXISTS idx_customer_charge_orders_order  ON public.customer_charge_orders(order_id);
