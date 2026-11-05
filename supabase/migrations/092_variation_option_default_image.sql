-- ============================================================
-- PRECY+ — Migration 092: Imagem padrão por opção de variação
-- ============================================================
-- Permite configurar uma imagem padrão por OPÇÃO (ex: "Florido" no grupo
-- Modelo), em vez de precisar escolher a imagem manualmente em cada
-- combinação que usa essa opção. A combinação continua podendo ter uma
-- imagem própria (product_variants.image_id) que sempre tem prioridade —
-- isto aqui é só o valor usado quando a combinação está em "Padrão".
ALTER TABLE public.product_variation_options
  ADD COLUMN default_image_id UUID REFERENCES public.product_images(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.product_variation_options.default_image_id IS
  'Imagem padrão aplicada às combinações que usam esta opção e ainda não têm imagem própria escolhida (product_variants.image_id).';
