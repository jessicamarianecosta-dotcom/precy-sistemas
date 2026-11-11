-- ═══════════════════════════════════════════════════════════════
-- PrecyFlow: plano próprio, separado do Basic/Pro do Precy+
--
-- current_plan='precyflow' é uma assinatura única (R$97/ano, 300 produtos),
-- não um nível dentro da escada Basic→Pro do Precy+. Ainda assim o
-- PrecyFlow usa as MESMAS tabelas (products, orders, customers, budgets,
-- inventory, suppliers, financial_transactions, calendar_tasks, catálogo).
--
-- Decisão de produto (não detalhada no documento-fonte, registrada aqui):
-- toda conta 'precyflow' ativa/trial deve enxergar Agenda, Financeiro e
-- Vitrine/Catálogo como módulos padrão — hoje essas tabelas são liberadas
-- só para quem tem current_plan='pro' (company_has_pro_access) ou está no
-- beta de catálogo (company_has_catalog_access). A correção mais simples e
-- consistente é tratar 'precyflow' como mais um valor aceito ao lado de
-- 'pro' nessas duas funções — sem alterar em nada o comportamento para
-- quem está no Basic/Pro do Precy+.
-- ═══════════════════════════════════════════════════════════════

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
        OR (c.current_plan IN ('pro', 'precyflow') AND c.subscription_status = 'active')
        OR (
          c.current_plan IN ('pro', 'precyflow') AND c.subscription_status = 'past_due'
          AND c.grace_period_end IS NOT NULL AND c.grace_period_end > NOW()
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.company_has_catalog_access(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND (
        c.role = 'developer'
        OR c.current_plan IN ('pro', 'precyflow')
        OR (c.subscription_status = 'trialing' AND (c.trial_end IS NULL OR c.trial_end > NOW()))
      )
  );
$$;

-- ── Limite de 300 produtos cadastrados no plano PrecyFlow ──
-- Espelha o espírito de check_catalog_product_limit (migration 045), mas
-- aplicado a QUALQUER cadastro de produto (não só publicado na vitrine).
CREATE OR REPLACE FUNCTION public.check_precyflow_product_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan  TEXT;
  v_count INT;
BEGIN
  SELECT current_plan INTO v_plan FROM public.companies WHERE id = NEW.company_id;

  IF v_plan = 'precyflow' THEN
    SELECT COUNT(*) INTO v_count FROM public.products WHERE company_id = NEW.company_id;
    IF v_count >= 300 THEN
      RAISE EXCEPTION 'Limite de 300 produtos cadastrados atingido no plano PrecyFlow.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS precyflow_product_limit_trigger ON public.products;
CREATE TRIGGER precyflow_product_limit_trigger
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_precyflow_product_limit();
