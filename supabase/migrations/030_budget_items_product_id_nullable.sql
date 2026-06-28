-- 030_budget_items_product_id_nullable.sql
-- Permite itens manuais/serviços sem produto vinculado (orçamento livre)
-- Antes: product_id NOT NULL → INSERT de item manual falhava silenciosamente
-- Depois: product_id nullable → itens manuais são salvos corretamente

ALTER TABLE public.budget_items ALTER COLUMN product_id DROP NOT NULL;
