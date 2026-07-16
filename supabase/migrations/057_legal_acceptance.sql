-- ============================================================
-- PRECY+ — Migration 057: Aceite jurídico de Termos/Privacidade + LGPD
-- ============================================================
-- user_consents é definida em duas migrations antigas (015, 016), mas
-- confirmado via consulta direta ao banco de produção que ELA NUNCA FOI
-- CRIADA (information_schema.columns retorna vazio) — recriando aqui do
-- zero, com o schema que este recurso realmente precisa (company_id,
-- accepted_ip, accepted_user_agent, terms_version/privacy_version
-- separados em vez de um "type" genérico).
-- ============================================================

CREATE TABLE public.user_consents (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id           UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  terms_version        TEXT NOT NULL,
  privacy_version      TEXT NOT NULL,
  accepted_ip          TEXT,
  accepted_user_agent  TEXT,
  accepted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_consents_user ON public.user_consents(user_id, accepted_at DESC);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_consents_own" ON public.user_consents FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── LGPD: solicitações de exclusão/anonimização (registradas, nunca
-- executadas automaticamente — fulfillment é manual, ver política de
-- privacidade) ──
CREATE TABLE public.lgpd_requests (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id    UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  request_type  TEXT NOT NULL CHECK (request_type IN ('deletion', 'anonymization')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT
);

CREATE INDEX idx_lgpd_requests_user ON public.lgpd_requests(user_id, requested_at DESC);

ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lgpd_requests_own_select" ON public.lgpd_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "lgpd_requests_own_insert" ON public.lgpd_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());
