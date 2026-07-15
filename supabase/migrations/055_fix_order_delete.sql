-- ============================================================
-- PRECY+ — Migration 055: Corrige exclusão de pedidos
-- ============================================================
-- CAUSA RAIZ (reproduzida em produção via transação com rollback):
-- Excluir um pedido com recebimento(s) registrado(s) cascateia o delete
-- para payment_history (ON DELETE CASCADE), o que dispara o trigger
-- trg_payment_history_audit (AFTER DELETE), que tenta INSERIR uma linha
-- em payment_history_audit referenciando o próprio order_id que acabou
-- de ser apagado — e essa tabela tinha order_id NOT NULL REFERENCES
-- orders(id), uma FK "dura" num log de auditoria que por definição
-- precisa sobreviver à exclusão do pedido original. Resultado: toda
-- exclusão de pedido com pagamento (ex.: qualquer pedido pago via
-- Catálogo Online, que sempre gera payment_history pelo webhook)
-- falhava com "foreign key constraint... is not present in table orders".
--
-- Erro real reproduzido:
--   ERROR: insert or update on table "payment_history_audit" violates
--   foreign key constraint "payment_history_audit_order_id_fkey"
--   DETAIL: Key (order_id)=(...) is not present in table "orders".
--
-- Como o front-end não checava o erro do delete (ver fix em
-- app/(dashboard)/pedidos/page.tsx), a falha ficava invisível: o toast
-- dizia "Pedido removido!" mesmo o DELETE tendo sido revertido pelo
-- Postgres, e o pedido continuava na lista após o refresh.
-- ============================================================

-- 1. payment_history_audit é log de auditoria — precisa sobreviver à
--    exclusão do pedido original (mesma lógica já aplicada a
--    payment_history_id, que nunca teve FK por este exato motivo,
--    conforme o comentário original da migration 039).
ALTER TABLE public.payment_history_audit
  DROP CONSTRAINT IF EXISTS payment_history_audit_order_id_fkey;

-- 2. budgets.converted_to_order_id nunca teve ON DELETE definido
--    (default NO ACTION) — únicas FK deste tipo no banco que ainda
--    bloqueava a exclusão. Alinha com o padrão já usado em
--    calendar_tasks/financial_transactions/transactions (SET NULL):
--    o orçamento continua existindo, só perde a referência ao pedido
--    apagado.
ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_converted_to_order_id_fkey;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_converted_to_order_id_fkey
  FOREIGN KEY (converted_to_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
