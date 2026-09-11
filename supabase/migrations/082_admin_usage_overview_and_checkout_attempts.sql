-- ═══════════════════════════════════════════════════════════════
-- Visibilidade de engajamento no painel /admin/assinantes
--
-- Duas peças, nenhuma mexe em regra de acesso/trial/cobrança existente:
--
-- 1) admin_get_company_usage_stats(): agrega, numa ÚNICA consulta, o
--    último acesso (auth.users.last_sign_in_at) e as contagens de
--    products/customers/orders/budgets/product_materials de TODAS as
--    empresas. Evita N consultas × M empresas no painel admin (ver
--    lib/admin/getAssinantes.ts).
--
--    Precisa ser SECURITY DEFINER porque auth.users não é acessível via
--    PostgREST/RLS normalmente. Por segurança: a função é revogada de
--    anon/authenticated e só pode ser chamada via service_role — ou seja,
--    só o backend (supabaseAdmin) consegue chamá-la, nunca o browser
--    diretamente. A própria API admin (/api/admin/assinantes) já checa
--    o e-mail da administradora antes de chegar aqui; isto é defesa em
--    profundidade, não a única barreira.
--
-- 2) checkout_attempts: registra quando uma Checkout Session do Stripe é
--    criada (ver app/api/stripe/checkout/route.ts) e é atualizada pelo
--    webhook quando a sessão é concluída ou expira — nunca antes disso,
--    para não "inventar" abandono sem confirmação do Stripe.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_get_company_usage_stats()
RETURNS TABLE (
  company_id       uuid,
  last_sign_in_at  timestamptz,
  n_products       bigint,
  n_customers      bigint,
  n_orders         bigint,
  n_budgets        bigint,
  n_materials      bigint,
  checkout_status  text,
  checkout_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
  SELECT
    c.id,
    u.last_sign_in_at,
    COALESCE(p.cnt, 0),
    COALESCE(cu.cnt, 0),
    COALESCE(o.cnt, 0),
    COALESCE(b.cnt, 0),
    COALESCE(m.cnt, 0),
    chk.status,
    chk.created_at
  FROM public.companies c
  LEFT JOIN auth.users u
    ON u.id = c.user_id
  LEFT JOIN (SELECT company_id, count(*) cnt FROM public.products         GROUP BY company_id) p  ON p.company_id  = c.id
  LEFT JOIN (SELECT company_id, count(*) cnt FROM public.customers        GROUP BY company_id) cu ON cu.company_id = c.id
  LEFT JOIN (SELECT company_id, count(*) cnt FROM public.orders           GROUP BY company_id) o  ON o.company_id  = c.id
  LEFT JOIN (SELECT company_id, count(*) cnt FROM public.budgets          GROUP BY company_id) b  ON b.company_id  = c.id
  LEFT JOIN (SELECT company_id, count(*) cnt FROM public.product_materials GROUP BY company_id) m ON m.company_id  = c.id
  LEFT JOIN LATERAL (
    SELECT status, created_at
    FROM public.checkout_attempts ca
    WHERE ca.company_id = c.id
    ORDER BY ca.created_at DESC
    LIMIT 1
  ) chk ON true;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_company_usage_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_company_usage_stats() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_company_usage_stats() TO service_role;

-- ═══════════════════════════════════════════════════════════════
-- checkout_attempts
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.checkout_attempts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id                     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_checkout_session_id  text NOT NULL UNIQUE,
  stripe_customer_id          text,
  price_id                    text,
  plan                        text,
  status                      text NOT NULL DEFAULT 'started'
                              CHECK (status IN ('started','completed','expired','abandoned','failed')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_attempts_company_id ON public.checkout_attempts(company_id);
CREATE INDEX IF NOT EXISTS idx_checkout_attempts_status     ON public.checkout_attempts(status);

CREATE TRIGGER set_updated_at_checkout_attempts
  BEFORE UPDATE ON public.checkout_attempts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;

-- Só leitura tenant-scoped (caso um dia seja exibido dentro do próprio app,
-- ex. "seu histórico de tentativas de assinatura"). Sem policy de
-- INSERT/UPDATE/DELETE para authenticated — sem policy permissiva, RLS
-- nega por padrão. Toda escrita hoje vem do backend com supabaseAdmin
-- (service role, que bypassa RLS): /api/stripe/checkout/route.ts cria a
-- linha ao gerar a Checkout Session, e /api/webhooks/stripe/route.ts
-- atualiza o status quando o Stripe confirma o que aconteceu.
CREATE POLICY "checkout_attempts_tenant_select" ON public.checkout_attempts
  FOR SELECT
  USING (company_id = public.get_user_company_id());
