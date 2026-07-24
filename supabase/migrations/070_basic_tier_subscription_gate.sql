-- ═══════════════════════════════════════════════════════════════
-- AUDITORIA DE ASSINATURA #2 — bloqueio do plano Basic sem pagamento
--
-- Causa raiz #1: o Basic é um plano PAGO (R$17/mês, ver PlansSection.tsx),
-- não um tier gratuito. Toda empresa nasce com current_plan='basic' +
-- subscription_status='trialing' (trial interno de 7 dias, sem cobrar
-- cartão — ver /api/setup-company). Se o usuário nunca completa o
-- checkout do Stripe (nem Basic nem Pro), NENHUM webhook jamais dispara
-- para essa empresa, então subscription_status permanece 'trialing'
-- para sempre, com trial_end no passado.
--
-- middleware.ts, lib/subscription/check.ts e hooks/useSubscription.ts
-- tratavam status='trialing' como "nunca bloqueia", usando trial_end
-- apenas para decidir se o acesso PRO continua liberado — nunca para
-- decidir se o acesso deveria ser cortado por completo. Resultado:
-- toda empresa que nunca assina fica com acesso Basic completo e
-- permanente, de graça, para sempre. Corrigido em código nesses 3
-- arquivos; esta migration é a camada de defesa no banco.
--
-- Causa raiz #2 (encontrada AO CONFERIR O BANCO DE PRODUÇÃO ANTES de
-- aplicar esta migration — o diretório local supabase/migrations está
-- desatualizado em relação ao remoto, faltam 9 migrations aplicadas
-- direto: 058_backfill_trial_end...066_trial_fingerprints): as tabelas
-- do plano Basic (orders, customers, inventory, budgets, fixed_costs,
-- product_materials) têm DUAS policies permissivas simultâneas — a
-- "_tenant" (mais nova) e uma legada de check-then-insert antiga tipo
-- "Users can manage own X", nunca dropada. RLS combina policies
-- permissivas com OR: só adicionar o gate na "_tenant" não teria efeito
-- nenhum, porque a policy legada (sem NENHUMA checagem de plano) sempre
-- continuaria liberando acesso sozinha. fixed_costs tinha até 4 policies
-- legadas simultâneas (select/insert/delete/manage), além da tenant.
-- Todas são dropadas nesta migration antes de criar a policy única e
-- corretamente restritiva.
-- ═══════════════════════════════════════════════════════════════

-- company_has_basic_access(): TRUE somente quando existe acesso válido
-- de QUALQUER tipo — trial ainda vigente, assinatura paga ativa (Basic
-- ou Pro), ou tolerância de past_due/cancelamento dentro do prazo.
-- FALSE para trial expirado sem assinatura, e para qualquer status que
-- não signifique "está pagando ou ainda dentro do trial".
CREATE OR REPLACE FUNCTION public.company_has_basic_access(p_company_id uuid)
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
        OR c.subscription_status = 'active'
        OR (c.subscription_status = 'past_due' AND c.grace_period_end IS NOT NULL AND c.grace_period_end > NOW())
        OR (c.subscription_status = 'canceled' AND c.current_period_end IS NOT NULL AND c.current_period_end > NOW())
      )
  );
$function$;

-- ── orders ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own orders" ON public.orders;
DROP POLICY IF EXISTS "orders_tenant" ON public.orders;
CREATE POLICY "orders_tenant" ON public.orders FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── products ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "products_tenant" ON public.products;
CREATE POLICY "products_tenant" ON public.products FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── inventory ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own inventory" ON public.inventory;
DROP POLICY IF EXISTS "inventory_tenant" ON public.inventory;
CREATE POLICY "inventory_tenant" ON public.inventory FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── customers ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own customers" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant" ON public.customers;
CREATE POLICY "customers_tenant" ON public.customers FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── budgets ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own budgets" ON public.budgets;
DROP POLICY IF EXISTS "budgets_tenant" ON public.budgets;
CREATE POLICY "budgets_tenant" ON public.budgets FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── fixed_costs (tinha 4 policies legadas além da tenant) ────────────
DROP POLICY IF EXISTS "Users can manage own fixed_costs" ON public.fixed_costs;
DROP POLICY IF EXISTS "fixed_costs_select" ON public.fixed_costs;
DROP POLICY IF EXISTS "fixed_costs_insert" ON public.fixed_costs;
DROP POLICY IF EXISTS "fixed_costs_delete" ON public.fixed_costs;
DROP POLICY IF EXISTS "fixed_costs_tenant" ON public.fixed_costs;
CREATE POLICY "fixed_costs_tenant" ON public.fixed_costs FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── product_materials ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own product_materials" ON public.product_materials;
DROP POLICY IF EXISTS "product_materials_tenant" ON public.product_materials;
CREATE POLICY "product_materials_tenant" ON public.product_materials FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── product_categories (sem policy legada) ───────────────────────
DROP POLICY IF EXISTS "product_categories_tenant" ON public.product_categories;
CREATE POLICY "product_categories_tenant" ON public.product_categories FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── order_files / order_art_events (sem policy legada) ───────────
DROP POLICY IF EXISTS "order_files_tenant" ON public.order_files;
CREATE POLICY "order_files_tenant" ON public.order_files FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

DROP POLICY IF EXISTS "order_art_events_tenant" ON public.order_art_events;
CREATE POLICY "order_art_events_tenant" ON public.order_art_events FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- product_images / product_variants: só a policy do DONO (tenant). A
-- policy "*_public_read" (vitrine pública do Catálogo Online) usa
-- company_has_catalog_access, um gate de beta separado — não mexer.
DROP POLICY IF EXISTS "product_images_tenant" ON public.product_images;
CREATE POLICY "product_images_tenant" ON public.product_images FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

DROP POLICY IF EXISTS "product_variants_tenant" ON public.product_variants;
CREATE POLICY "product_variants_tenant" ON public.product_variants FOR ALL
  USING      (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_basic_access(company_id));

-- ── Fornecedores (sem policy legada) ──────────────────────────────
DROP POLICY IF EXISTS "suppliers_company_all" ON public.suppliers;
CREATE POLICY "suppliers_company_all" ON public.suppliers FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         AND public.company_has_basic_access(company_id));

DROP POLICY IF EXISTS "supplier_materials_company_all" ON public.supplier_materials;
CREATE POLICY "supplier_materials_company_all" ON public.supplier_materials FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         AND public.company_has_basic_access(company_id));

DROP POLICY IF EXISTS "supplier_purchases_company_all" ON public.supplier_purchases;
CREATE POLICY "supplier_purchases_company_all" ON public.supplier_purchases FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         AND public.company_has_basic_access(company_id));

DROP POLICY IF EXISTS "material_price_history_company_all" ON public.material_price_history;
CREATE POLICY "material_price_history_company_all" ON public.material_price_history FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         AND public.company_has_basic_access(company_id))
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         AND public.company_has_basic_access(company_id));

-- ═══════════════════════════════════════════════════════════════
-- NÃO alteradas nesta migration (conferido direto no banco antes de
-- decidir, via pg_policies — e por quê):
--
-- • budget_items, order_items, supplier_purchase_items — suas policies
--   fazem EXISTS/JOIN/IN contra budgets/orders/supplier_purchases,
--   tabelas que acabaram de ganhar o gate acima. Essas subqueries rodam
--   sob RLS da tabela referenciada, então herdam o bloqueio
--   automaticamente (confirmado lendo cada policy no banco antes de
--   decidir não duplicar o gate — nenhuma delas checa companies direto,
--   todas passam por orders/budgets/supplier_purchases).
--
-- • financial_transactions, cost_centers, calendar_tasks, recurring_bills
--   — já usam company_has_pro_access (migration 067/060), conferido no
--   banco: cada uma tem uma única policy limpa, sem duplicata legada.
--   company_has_pro_access é estritamente mais restritivo que
--   company_has_basic_access (todo acesso PRO implica acesso Basic).
--
-- • feedbacks — já usa company_has_paid_plan (migration 069), que por
--   desenho exclui trial de propósito (regra de negócio diferente,
--   documentada naquela migration). Confirmado no banco: policy única,
--   sem duplicata. Não mexer.
--
-- • catalog_categories, catalog_settings, library_products, e as
--   policies "*_public_read"/"products_catalog_public_read" — o
--   Catálogo Online é beta privado com gate próprio por e-mail
--   (company_has_catalog_access), fora do escopo desta correção.
--   OBSERVAÇÃO À PARTE (não corrigida aqui, fora de escopo): essa
--   função trata trial_end NULL como acesso liberado ("trial eterno"),
--   o mesmo bug que a migration 067 corrigiu em company_has_pro_access
--   — mas o blast radius fica restrito a quem já está na allowlist de
--   e-mail do beta, então não faz parte desta auditoria de assinatura.
--
-- • companies, profiles, user_consents, lgpd_requests, subscriptions,
--   payment_history* — precisam continuar legíveis mesmo com a empresa
--   bloqueada (é como a tela de bloqueio sabe o que mostrar, e são
--   registros de conta/LGPD/cobrança, não dados operacionais do plano).
-- ═══════════════════════════════════════════════════════════════
