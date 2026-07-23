-- ═══════════════════════════════════════════════════════════════
-- AUDITORIA DE ASSINATURA — correção na origem (não gambiarra)
--
-- Causa raiz #1: companies.user_id não tinha UNIQUE, e a rota de
-- setup (check-then-insert) tinha race condition. Isso permitiu
-- 2 registros de companies para o mesmo usuário (ivannogueira21@
-- gmail.com). middleware.ts usava .single() para buscar a empresa
-- do usuário — com 2 linhas, o Supabase/PostgREST retorna erro
-- (PGRST116, "multiple rows returned") e `company` vira undefined.
-- O código então caía nos valores padrão (status='trialing',
-- trial_end=null), que a própria isTrialExpired() trata como
-- "nunca expira" → acesso PRO permanente e irrevogável.
--
-- Causa raiz #2: company_has_pro_access() liberava acesso sempre
-- que current_plan='pro', SEM checar subscription_status. Como o
-- webhook do Stripe só reverte current_plan para 'basic' no evento
-- customer.subscription.deleted (cancelamento definitivo) — não em
-- past_due/unpaid/incomplete_expired, que podem durar dias/semanas
-- de tentativas de cobrança — uma assinatura inadimplente mantinha
-- current_plan='pro' e, portanto, acesso total via RLS a
-- financial_transactions, calendar_tasks, cost_centers e
-- recurring_bills mesmo direto pela API (curl/Postman), já que RLS
-- é a única barreira real para chamadas que não passam pelo
-- middleware do Next.js.
-- ═══════════════════════════════════════════════════════════════

-- 1) Remove o registro duplicado e vazio (0 pedidos/clientes/produtos/
--    orçamentos/estoque/financeiro em qualquer tabela — confirmado
--    antes desta migration) criado pela race condition.
DELETE FROM public.companies
WHERE id = '4aca7fbd-a0c1-4d5e-a015-f350a481417e'
  AND user_id = '6d8cbaea-9494-4d61-9069-853f0bf77c0b';

-- 2) Impede que o bug volte a acontecer: 1 empresa por usuário.
ALTER TABLE public.companies
  ADD CONSTRAINT companies_user_id_key UNIQUE (user_id);

-- 3) get_user_company_id(): defesa extra — se por qualquer motivo
--    futuro existirem linhas duplicadas, sempre resolve de forma
--    determinística (a mais antiga), nunca arbitrariamente.
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id FROM public.companies
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$function$;

-- 4) company_has_pro_access(): agora TRUE somente quando:
--    • role = developer, OU
--    • trial ainda vigente (trial_end obrigatoriamente no futuro —
--      trial_end NULL passa a ser tratado como "sem trial", não
--      como "trial eterno"), OU
--    • current_plan = 'pro' E subscription_status realmente permite
--      acesso (active, ou past_due dentro do prazo de tolerância).
--    canceled / unpaid / incomplete / incomplete_expired / past_due
--    (fora da tolerância) → sempre FALSE, mesmo com current_plan
--    ainda marcado como 'pro' no banco.
CREATE OR REPLACE FUNCTION public.company_has_pro_access(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND (
        c.role = 'developer'
        OR (c.subscription_status = 'trialing' AND c.trial_end IS NOT NULL AND c.trial_end > NOW())
        OR (c.current_plan = 'pro' AND c.subscription_status = 'active')
        OR (
          c.current_plan = 'pro' AND c.subscription_status = 'past_due'
          AND c.grace_period_end IS NOT NULL AND c.grace_period_end > NOW()
        )
      )
  );
$function$;
