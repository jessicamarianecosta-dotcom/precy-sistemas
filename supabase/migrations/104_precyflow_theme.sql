-- PrecyFlow: preferência de tema salva na empresa (perfil/configuração).
-- 'cat' = mascote + paleta rosa fixa. 'cores' = paleta sólida à escolha,
-- sem mascote (ver documento PrecyFlow, seção 2).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS precyflow_theme TEXT NOT NULL DEFAULT 'cat',
  ADD COLUMN IF NOT EXISTS precyflow_color TEXT NOT NULL DEFAULT 'rosa';
