-- ============================================================
-- PRECY+ — Migration 073: Contas a Receber (payment_schedule)
-- ============================================================
-- Hoje o Pedido só sabe "quanto falta receber" (orders.remaining_amount)
-- e uma única data (orders.due_date — na verdade o PRAZO DE ENTREGA, não
-- vencimento de pagamento). Não existe conceito de parcela, forma de
-- pagamento acionável (é só um campo informativo), nem lançamento de
-- "a receber" em nenhuma tela — o pedido só aparece em Financeiro,
-- Fluxo de Caixa, Dashboard e Projeção quando o dinheiro já entrou de
-- fato (via register_order_payment → financial_transactions status
-- 'received').
--
-- payment_schedule é o análogo, do lado da receita, do que
-- recurring_bills+financial_transactions já faz do lado da despesa:
-- cada parcela esperada de um pedido vira uma linha própria, com sua
-- própria data de vencimento e status — sem nunca tocar em
-- financial_transactions/DRE até o dinheiro realmente entrar.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_schedule (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id         UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  order_id           UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  customer_id        UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  installment_number INTEGER NOT NULL DEFAULT 1,
  installment_count  INTEGER NOT NULL DEFAULT 1,
  due_date           DATE NOT NULL,
  amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method     TEXT NOT NULL DEFAULT 'outro'
                       CHECK (payment_method IN (
                         'dinheiro', 'pix', 'cartao_credito', 'cartao_debito',
                         'boleto', 'transferencia', 'crediario', 'outro'
                       )),
  card_brand         TEXT,
  card_fee_percent   NUMERIC(5,2),
  boleto_number      TEXT,
  notes              TEXT,
  status             TEXT NOT NULL DEFAULT 'a_receber'
                       CHECK (status IN ('a_receber', 'parcial', 'recebido', 'cancelado')),
  received_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (order_id, installment_number)
);

ALTER TABLE public.payment_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_schedule_tenant" ON public.payment_schedule;
CREATE POLICY "payment_schedule_tenant" ON public.payment_schedule FOR ALL
  USING      (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_payment_schedule_company_due ON public.payment_schedule(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_order        ON public.payment_schedule(order_id);

-- ── Rastreia qual parcela um pagamento específico do payment_history quitou ──
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.payment_schedule(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payment_history_schedule ON public.payment_history(schedule_id);

-- ============================================================
-- Funções atômicas: registrar/editar/excluir pagamento passam a
-- reconciliar payment_schedule no mesmo INSERT/UPDATE transacional,
-- evitando qualquer divergência entre "quanto essa parcela recebeu" e
-- "quanto o pedido recebeu no total". Assinatura estendida com
-- p_schedule_id (DEFAULT NULL) — chamadas existentes (webhook do
-- Catálogo Online, fluxo de pagamento sem parcela) continuam
-- funcionando exatamente como antes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_order_payment(
  p_order_id uuid, p_company_id uuid, p_customer_id uuid, p_amount numeric,
  p_payment_date date, p_payment_method text, p_observation text, p_percentage numeric,
  p_order_number text, p_service_name text, p_client_name text, p_created_by uuid,
  p_catalog_checkout_ref text DEFAULT NULL::text,
  p_schedule_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment_id      uuid;
  v_schedule_amount numeric;
  v_schedule_received numeric;
  v_new_received    numeric;
  v_new_status      text;
BEGIN
  INSERT INTO public.payment_history (
    order_id, customer_id, company_id, amount, payment_date, payment_method,
    observation, percentage, created_by, catalog_checkout_ref, schedule_id
  ) VALUES (
    p_order_id, p_customer_id, p_company_id, p_amount, p_payment_date, p_payment_method,
    p_observation, p_percentage, p_created_by, p_catalog_checkout_ref, p_schedule_id
  ) RETURNING id INTO v_payment_id;

  INSERT INTO public.financial_transactions (
    company_id, order_id, payment_history_id, type, category, amount,
    description, date, status, client_name
  ) VALUES (
    p_company_id, p_order_id, v_payment_id, 'income', 'vendas', p_amount,
    'Recebimento — Pedido ' || COALESCE(p_order_number, '') || ' · ' || COALESCE(p_service_name, 'Serviço') ||
      CASE WHEN p_observation IS NOT NULL AND p_observation <> '' THEN ' · ' || p_observation ELSE '' END,
    p_payment_date, 'received', p_client_name
  );

  IF p_schedule_id IS NOT NULL THEN
    SELECT amount, received_amount INTO v_schedule_amount, v_schedule_received
    FROM public.payment_schedule WHERE id = p_schedule_id;

    IF FOUND THEN
      v_new_received := COALESCE(v_schedule_received, 0) + p_amount;
      v_new_status := CASE
        WHEN v_new_received >= v_schedule_amount THEN 'recebido'
        WHEN v_new_received > 0               THEN 'parcial'
        ELSE 'a_receber'
      END;

      UPDATE public.payment_schedule
      SET received_amount = v_new_received,
          status          = v_new_status,
          paid_at         = CASE WHEN v_new_status = 'recebido' THEN p_payment_date::timestamptz ELSE paid_at END,
          updated_at      = NOW()
      WHERE id = p_schedule_id;
    END IF;
  END IF;

  RETURN v_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_payment(
  p_payment_id uuid, p_amount numeric, p_payment_date date, p_payment_method text,
  p_observation text, p_percentage numeric, p_description text
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_schedule_id     uuid;
  v_old_amount      numeric;
  v_schedule_amount numeric;
  v_schedule_received numeric;
  v_new_received    numeric;
  v_new_status      text;
BEGIN
  SELECT schedule_id, amount INTO v_schedule_id, v_old_amount
  FROM public.payment_history WHERE id = p_payment_id;

  UPDATE public.payment_history
  SET amount = p_amount, payment_date = p_payment_date, payment_method = p_payment_method,
      observation = p_observation, percentage = p_percentage, updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE public.financial_transactions
  SET amount = p_amount, date = p_payment_date, description = p_description, updated_at = NOW()
  WHERE payment_history_id = p_payment_id;

  IF v_schedule_id IS NOT NULL THEN
    SELECT amount, received_amount INTO v_schedule_amount, v_schedule_received
    FROM public.payment_schedule WHERE id = v_schedule_id;

    IF FOUND THEN
      v_new_received := GREATEST(0, COALESCE(v_schedule_received, 0) - COALESCE(v_old_amount, 0) + p_amount);
      v_new_status := CASE
        WHEN v_new_received >= v_schedule_amount THEN 'recebido'
        WHEN v_new_received > 0                THEN 'parcial'
        ELSE 'a_receber'
      END;

      UPDATE public.payment_schedule
      SET received_amount = v_new_received,
          status          = v_new_status,
          paid_at          = CASE WHEN v_new_status = 'recebido' THEN p_payment_date::timestamptz ELSE NULL END,
          updated_at       = NOW()
      WHERE id = v_schedule_id;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_order_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_schedule_id     uuid;
  v_amount          numeric;
  v_schedule_amount numeric;
  v_schedule_received numeric;
  v_new_received    numeric;
  v_new_status      text;
BEGIN
  SELECT schedule_id, amount INTO v_schedule_id, v_amount
  FROM public.payment_history WHERE id = p_payment_id;

  DELETE FROM public.financial_transactions WHERE payment_history_id = p_payment_id;
  DELETE FROM public.payment_history WHERE id = p_payment_id;

  IF v_schedule_id IS NOT NULL THEN
    SELECT amount, received_amount INTO v_schedule_amount, v_schedule_received
    FROM public.payment_schedule WHERE id = v_schedule_id;

    IF FOUND THEN
      v_new_received := GREATEST(0, COALESCE(v_schedule_received, 0) - COALESCE(v_amount, 0));
      v_new_status := CASE
        WHEN v_new_received >= v_schedule_amount THEN 'recebido'
        WHEN v_new_received > 0                THEN 'parcial'
        ELSE 'a_receber'
      END;

      UPDATE public.payment_schedule
      SET received_amount = v_new_received,
          status          = v_new_status,
          paid_at          = CASE WHEN v_new_status = 'recebido' THEN paid_at ELSE NULL END,
          updated_at       = NOW()
      WHERE id = v_schedule_id;
    END IF;
  END IF;
END;
$function$;

-- ============================================================
-- Backfill: pedidos existentes pendentes/parciais ganham uma parcela
-- retroativa (vencimento = prazo de entrega, valor = saldo devedor
-- real calculado do payment_history), para não sumir de Contas a
-- Receber/Projeção assim que a tela nova existir. Idempotente — só
-- roda para pedidos que ainda não têm nenhuma parcela.
-- ============================================================
INSERT INTO public.payment_schedule (
  company_id, order_id, customer_id, installment_number, installment_count,
  due_date, amount, payment_method, status, received_amount
)
SELECT
  o.company_id,
  o.id,
  o.customer_id,
  1, 1,
  COALESCE(o.due_date::date, o.order_date, CURRENT_DATE),
  o.total - COALESCE(ph.paid_sum, 0),
  CASE lower(COALESCE(o.payment_method, ''))
    WHEN 'dinheiro'       THEN 'dinheiro'
    WHEN 'pix'            THEN 'pix'
    WHEN 'cartao_credito' THEN 'cartao_credito'
    WHEN 'cartao_debito'  THEN 'cartao_debito'
    WHEN 'boleto'         THEN 'boleto'
    WHEN 'transferencia'  THEN 'transferencia'
    WHEN 'crediario'      THEN 'crediario'
    ELSE 'outro'
  END,
  'a_receber',
  0
FROM public.orders o
LEFT JOIN (
  SELECT order_id, SUM(amount) AS paid_sum FROM public.payment_history GROUP BY order_id
) ph ON ph.order_id = o.id
WHERE o.payment_status IN ('pending', 'partial')
  AND (o.total - COALESCE(ph.paid_sum, 0)) > 0
  AND NOT EXISTS (SELECT 1 FROM public.payment_schedule ps WHERE ps.order_id = o.id);
