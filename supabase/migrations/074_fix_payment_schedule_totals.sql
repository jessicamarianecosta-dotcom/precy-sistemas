-- ============================================================
-- PRECY+ — Migration 074: Corrige parcelas únicas de payment_schedule
-- ============================================================
-- O backfill da migration 073 gravou, em payment_schedule.amount, o
-- SALDO devedor do pedido (total - já recebido) em vez do VALOR TOTAL
-- da parcela — e received_amount sempre 0, mesmo quando parte do valor
-- já tinha sido recebida antes de payment_schedule existir. Resultado:
-- um pedido de R$120 com R$60 já recebidos aparecia em Contas a Receber
-- como "R$60 · A Receber", quando o correto é "Total R$120 · Recebido
-- R$60 · Saldo R$60 · Parcial".
--
-- Para toda parcela única (installment_count = 1 — inclui as 22
-- geradas pelo backfill e qualquer pedido pago à vista/boleto/pix
-- criado desde então), o valor da parcela É o valor total do pedido, e
-- o quanto já foi recebido é o SOMA real do payment_history — não um
-- campo derivado que pode ficar dessincronizado. Idempotente: rodar de
-- novo não altera nada que já esteja correto (inclusive pedidos
-- criados após a correção, cuja parcela já nasce certa).
-- ============================================================

WITH totals AS (
  SELECT
    ps.id AS schedule_id,
    ROUND(o.total, 2) AS order_total,
    LEAST(
      ROUND(o.total, 2),
      COALESCE((SELECT SUM(ph.amount) FROM public.payment_history ph WHERE ph.order_id = o.id), 0)
    ) AS received,
    (SELECT MAX(ph.payment_date) FROM public.payment_history ph WHERE ph.order_id = o.id) AS last_payment_date
  FROM public.payment_schedule ps
  JOIN public.orders o ON o.id = ps.order_id
  WHERE ps.installment_count = 1
)
UPDATE public.payment_schedule ps
SET
  amount          = totals.order_total,
  received_amount = totals.received,
  status          = CASE
                       WHEN totals.received >= totals.order_total AND totals.order_total > 0 THEN 'recebido'
                       WHEN totals.received > 0                                                THEN 'parcial'
                       ELSE 'a_receber'
                     END,
  paid_at         = CASE
                       WHEN totals.received >= totals.order_total AND totals.order_total > 0
                       THEN totals.last_payment_date::timestamptz
                       ELSE NULL
                     END,
  updated_at      = NOW()
FROM totals
WHERE ps.id = totals.schedule_id
  AND ps.status <> 'cancelado';
