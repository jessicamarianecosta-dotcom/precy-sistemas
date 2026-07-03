-- 036_order_payments_upgrade.sql
-- Controle profissional de recebimentos do pedido:
-- adiciona percentual/updated_at em payment_history, data de quitação em orders,
-- e vínculo 1:1 entre payment_history e a receita que ele gera no financeiro.

ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER set_updated_at_payment_history
  BEFORE UPDATE ON public.payment_history
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payment_history_id UUID REFERENCES public.payment_history(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ft_payment_history_id ON public.financial_transactions(payment_history_id);
