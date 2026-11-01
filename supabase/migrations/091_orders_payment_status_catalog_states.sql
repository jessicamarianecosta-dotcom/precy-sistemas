-- ============================================================
-- PRECY+ — Migration 091: novos status de pagamento para o Catálogo Online
-- ============================================================
-- orders.payment_status aceitava só pending/partial/paid/overdue (fluxo de
-- Contas a Receber manual). O Catálogo Online precisa refletir os estados
-- reais de uma cobrança de gateway que nunca foi concluída ou que foi
-- desfeita depois de paga — sem isso, uma recusa/expiração/reembolso teria
-- que ser forçado artificialmente em um desses quatro valores.
--
-- Não migra linhas existentes (nenhuma delas usa os valores novos ainda).
-- ============================================================

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS valid_payment;
ALTER TABLE public.orders ADD CONSTRAINT valid_payment
  CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue', 'failed', 'cancelled', 'refunded', 'expired'));
