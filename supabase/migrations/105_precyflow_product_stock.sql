-- PrecyFlow: Estoque de PRODUTO (distinto de Materiais/inventory, que já
-- cobre o estoque de insumos). "products" ainda não tinha quantidade
-- disponível nem estoque mínimo — necessário para o módulo Estoque do
-- documento PrecyFlow (seção 5.4), que pede alertas de reposição também
-- para o produto final, não só para os materiais usados na produção.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_stock  NUMERIC NOT NULL DEFAULT 0;
