-- ============================================================
-- PRECY+ — Migration 100: Grupo de variação opcional
-- ============================================================
-- Até aqui, toda combinação precisava ter exatamente uma opção escolhida em
-- CADA grupo de variação do produto — não havia como vender um produto onde
-- um grupo (ex: "Extra" → "Cantoneira") é só um adicional que o cliente pode
-- ou não querer.
--
-- `is_required` (default true — nenhum produto/grupo existente muda de
-- comportamento) permite marcar um grupo como opcional: a pessoa que
-- cadastra pode criar uma combinação sem nenhuma opção desse grupo
-- (product_variant_option_values simplesmente não tem linha para esse
-- group_id/variant_id), e na loja o cliente pode clicar de novo na opção já
-- selecionada pra desmarcá-la.
ALTER TABLE public.product_variation_groups
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.product_variation_groups.is_required IS
  'false = grupo opcional — a combinação pode não ter nenhuma opção deste grupo (ex: um "Extra" que o cliente pode recusar). true (padrão) = toda combinação precisa de uma opção deste grupo, como sempre foi.';
