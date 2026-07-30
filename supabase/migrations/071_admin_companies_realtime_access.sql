-- Painel admin (/admin/assinantes) somente leitura, restrito por e-mail no
-- middleware.ts. O Realtime do Supabase aplica RLS com o JWT de quem está
-- conectado no channel: sem uma policy de SELECT que cubra o admin, o INSERT
-- de OUTRAS empresas nunca chegaria na subscription dela (a policy existente
-- em companies só libera auth.uid() = user_id, ou seja, a própria empresa).
CREATE POLICY "Admin superuser can view all companies"
  ON public.companies FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'jessicamarianecosta@gmail.com');

-- Garante que companies está na publicação usada pelo Realtime (idempotente).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
