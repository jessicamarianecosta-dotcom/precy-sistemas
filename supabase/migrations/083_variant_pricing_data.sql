-- ============================================================
-- PRECY+ — Migration 083: snapshot da calculadora por variação
-- ============================================================
-- A tela de Precificação passa a poder precificar PRODUTO + COMBINAÇÃO.
-- pricing_data guarda o estado completo da calculadora para a combinação
-- (tipo, materiais, custos extras, margem, tempo de produção, medidas...),
-- permitindo reabrir e editar a precificação da variação exatamente como a
-- do produto. Aditiva e nullable: NULL = combinação sem precificação própria
-- (fallback para o produto). Os valores finais continuam em price/total_cost/
-- markup_percentage (migration 082).
-- ============================================================
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS pricing_data JSONB;
