-- ============================================================
-- PRECY+ — Migration 027: Alíquota de imposto (DRE Simplificado)
-- ============================================================
-- Módulo 4/8 do Financeiro Avançado (acesso PRO).
-- Percentual estimado de imposto sobre a receita bruta, usado
-- para calcular a linha "(-) Impostos" do DRE Simplificado.
-- Editável diretamente na aba DRE — não exige rastrear imposto
-- transação por transação.
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 6.00 NOT NULL;
  -- Default 6% = alíquota inicial típica do Simples Nacional (Anexo III)
  -- Apenas uma estimativa de partida; a usuária deve ajustar para seu regime real.
