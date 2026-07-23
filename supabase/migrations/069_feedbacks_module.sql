-- ═══════════════════════════════════════════════════════════════
-- Módulo Feedback — tabela, RLS e bucket de anexos
--
-- Regra de acesso pedida explicitamente: BASIC e PRO (pagantes) podem
-- usar o módulo; TRIAL não pode, mesmo tendo acesso PRO temporário em
-- outros módulos durante o período de teste. Por isso este módulo usa
-- uma função de gate PRÓPRIA (company_has_paid_plan), diferente de
-- company_has_pro_access — aqui o corte é "está realmente pagando"
-- (subscription_status = 'active', ou ainda dentro do período/
-- tolerância após past_due/cancelamento), nunca 'trialing'.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.company_has_paid_plan(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND (
        c.role = 'developer'
        OR c.subscription_status = 'active'
        OR (c.subscription_status = 'past_due' AND c.grace_period_end IS NOT NULL AND c.grace_period_end > NOW())
        OR (c.subscription_status = 'canceled' AND c.current_period_end IS NOT NULL AND c.current_period_end > NOW())
      )
  );
$function$;

CREATE TABLE public.feedbacks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type           text NOT NULL CHECK (type IN ('sugestao','bug','reclamacao','elogio','nova_funcionalidade')),
  subject        text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  message        text NOT NULL CHECK (char_length(message) BETWEEN 30 AND 3000),
  priority       text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta')),
  allow_contact  boolean NOT NULL DEFAULT false,
  attachment_url text,
  status         text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','em_analise','respondido','concluido')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedbacks_company_id ON public.feedbacks(company_id);
CREATE INDEX idx_feedbacks_status     ON public.feedbacks(status);
CREATE INDEX idx_feedbacks_created_at ON public.feedbacks(created_at DESC);

CREATE TRIGGER set_updated_at_feedbacks
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Cada empresa só vê/gerencia os próprios feedbacks, e só se tiver
-- plano pago ativo — bloqueio real no banco, não só no frontend.
CREATE POLICY "feedbacks_tenant" ON public.feedbacks
  FOR ALL
  USING (company_id = public.get_user_company_id() AND public.company_has_paid_plan(company_id))
  WITH CHECK (company_id = public.get_user_company_id() AND public.company_has_paid_plan(company_id));

-- ═══════════════════════════════════════════════════════════════
-- Storage: bucket dedicado feedback-attachments (10MB, imagem/PDF)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments', 'feedback-attachments', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf'];

CREATE POLICY "feedback_attachments_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-attachments');

CREATE POLICY "feedback_attachments_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-attachments'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
    AND public.company_has_paid_plan(public.get_user_company_id())
  );

CREATE POLICY "feedback_attachments_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );
