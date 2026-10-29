-- ============================================================
-- PRECY+ — Migration 088: Acréscimo de preço por opção de variação
-- ============================================================
-- 100% aditiva (só ADD COLUMN IF NOT EXISTS, tudo nullable): nenhum dado ou
-- comportamento existente muda. Até aqui, o preço de uma combinação
-- (product_variants.price) era sempre um valor absoluto; não existia o
-- conceito de "esta opção soma X ao preço base".
--
-- Agora cada OPÇÃO (product_variation_options) pode, opcionalmente, somar
-- um acréscimo ao preço-base da combinação em que ela aparece:
--   price_adjustment_type  = 'fixed'   → price_adjustment_value em R$
--   price_adjustment_type  = 'percent' → price_adjustment_value em % (ex: 10 = 10%)
--   price_adjustment_type  = NULL      → "Nenhum" (comportamento de hoje,
--                                         100% compatível com opções já
--                                         cadastradas, que ficam com NULL/NULL)
--
-- O acréscimo é calculado em tempo real (nunca congelado em product_variants
-- .price) por calcOptionsAdjustment() em lib/produtos/variantPricing.ts —
-- por isso, se o preço-base da combinação mudar, o valor do acréscimo
-- percentual é recalculado automaticamente, sem precisar editar nada aqui.
-- Quando há mais de uma opção com acréscimo na mesma combinação: valores
-- fixos se somam entre si; percentuais se somam entre si e são aplicados
-- UMA ÚNICA VEZ sobre o preço-base (nunca compostos em cascata), evitando
-- cobrança duplicada.
-- ============================================================

ALTER TABLE public.product_variation_options
  ADD COLUMN IF NOT EXISTS price_adjustment_type  TEXT
    CHECK (price_adjustment_type IS NULL OR price_adjustment_type IN ('fixed', 'percent')),
  ADD COLUMN IF NOT EXISTS price_adjustment_value NUMERIC(12,2);
