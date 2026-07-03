-- 036: Tipo de precificação por produto
-- Permite salvar o tipo de precificação selecionado (por unidade, m², metro linear, etc.)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'per_unit';
