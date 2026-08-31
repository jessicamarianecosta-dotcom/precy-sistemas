-- ============================================================
-- PRECY+ — Migration 078: modalidade/endereço de entrega em orders
-- ============================================================
-- Execute no SQL Editor do painel Supabase:
-- https://app.supabase.com -> SQL Editor -> New Query -> Paste -> Run
-- ============================================================
--
-- POR QUE:
-- A tabela `budgets` já possui `delivery_type` e `delivery_addr`, mas
-- `orders` não. Sem essas colunas, ao converter um orçamento em pedido a
-- modalidade de entrega (ex.: "Retirada") e o endereço de retirada da
-- LumiLife eram perdidos, e o orçamento gerado a partir do pedido não
-- conseguia reproduzir o bloco "Local de retirada".
--
-- Espelha exatamente os nomes usados em `budgets` (reuso, sem duplicar
-- conceito). Ambas as colunas são NULLABLE — pedidos manuais antigos e
-- novos continuam funcionando sem nenhum valor.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_type TEXT,
  ADD COLUMN IF NOT EXISTS delivery_addr TEXT;
