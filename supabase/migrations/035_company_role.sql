-- 035: Role de usuário na tabela companies
-- Permite identificar desenvolvedores/admins que bypassam as restrições de assinatura.

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Valores possíveis: 'user' | 'developer' | 'admin'
-- Desenvolvedor: acesso total, ignora plano/trial/bloqueio

UPDATE public.companies
SET role = 'developer'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'jessicamarianecosta@gmail.com');
