-- ============================================================
-- PRECY+ — Migration 048: Idempotência do webhook de pagamento
-- ============================================================
-- Sem isso, dois envios do mesmo evento (comum em gateways de pagamento
-- que reenviam em caso de timeout) podem passar pela checagem de
-- "já processado" antes que o primeiro termine de gravar, duplicando
-- payment_history/financial_transactions e baixando estoque duas vezes.
-- A própria UNIQUE constraint agora é a trava atômica: o segundo INSERT
-- falha com 23505 e o webhook trata isso como "já processado".
-- ============================================================

ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS catalog_checkout_ref TEXT UNIQUE;
