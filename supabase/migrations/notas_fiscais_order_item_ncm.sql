-- Permite preencher/corrigir o NCM de um item de pedido direto no Precy+
-- mesmo quando o item não está vinculado a um produto do catálogo
-- (order_items.product_id NULL — comum em pedidos de arte/estampa
-- personalizados, onde o item é digitado na hora).
--
-- lib/notasFiscais/fieldMapping.ts já lê `products.ncm` quando o item tem
-- product_id; este campo é só um FALLBACK para quando não tem. Não altera
-- nada da obrigatoriedade/validação de NF-e já existente — apenas dá uma
-- segunda fonte pro NCM do item, hoje inexistente para itens avulsos.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS ncm TEXT;

COMMENT ON COLUMN public.order_items.ncm IS
  'NCM do item para emissão de NF-e, usado como fallback quando product_id é NULL (item sem produto no catálogo) ou quando o produto vinculado não tem NCM cadastrado. Ver lib/notasFiscais/fieldMapping.ts.';
