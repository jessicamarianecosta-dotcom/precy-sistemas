-- Notas Fiscais — suporte a "nota avulsa" (emissão sem pedido vinculado).
--
-- Puramente aditivo: não altera bling_connections, não altera a lógica de
-- conexão/OAuth/chamadas ao Bling, e não altera o fluxo existente de notas
-- vinculadas a pedido (continua exigindo order_id preenchido, via o CHECK
-- abaixo). Só torna possível uma SEGUNDA origem de nota, sem order_id.

ALTER TABLE public.fiscal_invoices
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'pedido' CHECK (origin IN ('pedido', 'avulsa'));

-- Número de exibição da nota avulsa (ex.: "AV-0001"), já que não existe
-- order_number para usar como `numero`/`numeroPedidoLoja` da NF-e.
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS avulsa_numero TEXT;

-- Total da nota avulsa, só para exibição na lista (notas de pedido
-- continuam mostrando o total via join com orders, sem usar esta coluna).
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS total NUMERIC;

-- Consistência: nota de pedido sempre com order_id; nota avulsa sempre sem.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_invoices_origin_order_consistency'
  ) THEN
    ALTER TABLE public.fiscal_invoices
      ADD CONSTRAINT fiscal_invoices_origin_order_consistency
      CHECK (
        (origin = 'pedido' AND order_id IS NOT NULL) OR
        (origin = 'avulsa' AND order_id IS NULL)
      );
  END IF;
END $$;

-- Índice de unicidade de notas "vivas" por pedido (idx_fiscal_invoices_order_active)
-- não precisa de ajuste: em um índice único, múltiplos order_id NULL nunca
-- colidem entre si no Postgres — cada nota avulsa continua livre para existir
-- independente das outras.

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_origin ON public.fiscal_invoices(company_id, origin);
