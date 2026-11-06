-- ============================================================
-- PRECY+ — Migration 095: Personalização por produto (Catálogo Online)
-- ============================================================
-- Permite marcar cada produto, individualmente, como exigindo personalização
-- (envio de arte própria ou criação pela equipe) ou não. Controla a Etapa 2
-- do checkout (Produto e Arte): produtos não personalizados não exibem
-- nenhuma opção de arte e seguem direto para a próxima etapa.
--
-- Default TRUE (valor seguro para produtos já cadastrados): preserva o
-- comportamento atual — todo item passava pela etapa de arte — até o
-- lojista revisar e desmarcar os produtos que não precisam. Nunca presume
-- "não personalizado" por omissão.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS catalog_requires_customization BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.catalog_requires_customization IS
  'true = produto exige personalização/arte (própria ou criação pela equipe) na Etapa 2 do checkout da loja. false = produto vendido pronto, sem envio de arquivos nem aprovação de arte. Configuração individual por produto — nunca global.';
