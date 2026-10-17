-- ============================================================
-- PRECY+ — Migration 084: trava de saldo por parcela em register_order_payment
-- ============================================================
-- O Financeiro passa a receber parcela a parcela (payment_schedule). Esta
-- migration endurece a RPC register_order_payment para que o banco — e não
-- só a tela — garanta a integridade:
--   * valor deve ser > 0;
--   * a parcela informada precisa pertencer ao mesmo pedido/empresa e não
--     estar cancelada;
--   * a parcela é bloqueada (FOR UPDATE) durante o lançamento, então dois
--     cliques/abas simultâneos são serializados e o segundo é recusado se
--     o saldo da parcela já foi consumido (sem recebimento duplicado);
--   * o valor não pode exceder o saldo da parcela.
-- Chamadas sem p_schedule_id (webhook do Catálogo Online, pedidos legados)
-- seguem exatamente como antes. Nenhum dado existente é alterado.
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
  v_payment_id        uuid;
  v_schedule_amount   numeric;
  v_schedule_received numeric;
  v_schedule_order    uuid;
  v_schedule_company  uuid;
  v_schedule_status   text;
  v_new_received      numeric;
  v_new_status        text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor do recebimento deve ser maior que zero.';
  END IF;

  IF p_schedule_id IS NOT NULL THEN
    SELECT amount, received_amount, order_id, company_id, status
      INTO v_schedule_amount, v_schedule_received, v_schedule_order, v_schedule_company, v_schedule_status
    FROM public.payment_schedule
    WHERE id = p_schedule_id
    FOR UPDATE;

    IF NOT FOUND OR v_schedule_order <> p_order_id OR v_schedule_company <> p_company_id THEN
      RAISE EXCEPTION 'Parcela não encontrada para este pedido.';
    END IF;
    IF v_schedule_status = 'cancelado' THEN
      RAISE EXCEPTION 'Parcela cancelada não pode receber pagamento.';
    END IF;
    IF COALESCE(v_schedule_received, 0) + p_amount > v_schedule_amount THEN
      RAISE EXCEPTION 'Valor maior que o saldo da parcela (saldo: %).',
        to_char(v_schedule_amount - COALESCE(v_schedule_received, 0), 'FM999G999G990D00');
    END IF;
  END IF;

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
    v_new_received := COALESCE(v_schedule_received, 0) + p_amount;
    v_new_status := CASE
      WHEN v_new_received >= v_schedule_amount THEN 'recebido'
      WHEN v_new_received > 0                  THEN 'parcial'
      ELSE 'a_receber'
    END;

    UPDATE public.payment_schedule
    SET received_amount = v_new_received,
        status          = v_new_status,
        paid_at         = CASE WHEN v_new_status = 'recebido' THEN p_payment_date::timestamptz ELSE paid_at END,
        updated_at      = NOW()
    WHERE id = p_schedule_id;
  END IF;

  RETURN v_payment_id;
END;
$function$;
