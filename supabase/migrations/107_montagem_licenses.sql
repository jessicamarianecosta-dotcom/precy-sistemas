-- ==============================
-- Precy Montagem avulso — compra única (não-assinante Precy+) que libera
-- acesso ao /montagem por 1 ano, sem conta/senha: só cadastro simples
-- (nome/e-mail/telefone) + pagamento via Mercado Pago, e o acesso é
-- liberado direto (cookie assinado), sem código a digitar nem e-mail de
-- confirmação — ver lib/montagem/accessCookie.ts e
-- lib/montagem/licenseCascade.ts.
--
-- Não é tenant-scoped (sem company_id): é a Precy+ vendendo o próprio
-- produto, não uma loja de uma empresa cliente. Mesmo padrão de acesso
-- só por rota server-side com service role (nunca RLS anônima) já usado
-- em 106_order_charges_receipts.sql — aqui ainda mais estrito: nenhuma
-- policy, nem de leitura.
-- ==============================

CREATE TABLE IF NOT EXISTS public.montagem_licenses (
  id              UUID PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,

  amount_cents    INTEGER NOT NULL DEFAULT 2700,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  mp_payment_id   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ
);

ALTER TABLE public.montagem_licenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_montagem_licenses_email  ON public.montagem_licenses(email);
CREATE INDEX IF NOT EXISTS idx_montagem_licenses_status ON public.montagem_licenses(status);
