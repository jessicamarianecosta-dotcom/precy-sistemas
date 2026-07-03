-- 037_payment_history_audit.sql
-- Log de auditoria interno dos recebimentos: quem criou, editou ou excluiu,
-- valores antigo/novo, forma de pagamento, observação e quando.
-- Nunca exibido ao cliente — uso interno/auditoria.

CREATE TABLE IF NOT EXISTS public.payment_history_audit (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_history_id  UUID,                      -- sem FK: o recebimento pode ter sido excluído
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action              TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  old_amount          NUMERIC(12,2),
  new_amount          NUMERIC(12,2),
  old_payment_method  TEXT,
  new_payment_method  TEXT,
  old_payment_date    DATE,
  new_payment_date    DATE,
  old_observation     TEXT,
  new_observation     TEXT,
  performed_by        UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ph_audit_payment_history_id ON public.payment_history_audit(payment_history_id);
CREATE INDEX IF NOT EXISTS idx_ph_audit_order_id ON public.payment_history_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_ph_audit_company_id ON public.payment_history_audit(company_id, created_at DESC);

ALTER TABLE public.payment_history_audit ENABLE ROW LEVEL SECURITY;

-- Somente leitura para o dono da empresa. Escrita só acontece via trigger SECURITY DEFINER abaixo.
CREATE POLICY "payment_history_audit_select" ON public.payment_history_audit
  FOR SELECT
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- ==============================
-- Trigger: registra automaticamente toda alteração em payment_history
-- ==============================
CREATE OR REPLACE FUNCTION public.log_payment_history_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_history_audit (
      payment_history_id, order_id, company_id, action,
      new_amount, new_payment_method, new_payment_date, new_observation,
      performed_by
    ) VALUES (
      NEW.id, NEW.order_id, NEW.company_id, 'create',
      NEW.amount, NEW.payment_method, NEW.payment_date, NEW.observation,
      auth.uid()
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payment_history_audit (
      payment_history_id, order_id, company_id, action,
      old_amount, new_amount,
      old_payment_method, new_payment_method,
      old_payment_date, new_payment_date,
      old_observation, new_observation,
      performed_by
    ) VALUES (
      NEW.id, NEW.order_id, NEW.company_id, 'update',
      OLD.amount, NEW.amount,
      OLD.payment_method, NEW.payment_method,
      OLD.payment_date, NEW.payment_date,
      OLD.observation, NEW.observation,
      auth.uid()
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.payment_history_audit (
      payment_history_id, order_id, company_id, action,
      old_amount, old_payment_method, old_payment_date, old_observation,
      performed_by
    ) VALUES (
      OLD.id, OLD.order_id, OLD.company_id, 'delete',
      OLD.amount, OLD.payment_method, OLD.payment_date, OLD.observation,
      auth.uid()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_payment_history_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_history
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_history_audit();
