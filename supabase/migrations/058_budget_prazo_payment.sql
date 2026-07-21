-- ============================================================
-- PRECY+ — Migration 058: Prazo inteligente no pagamento de orçamentos
-- ============================================================
-- Condição "Prazo" ganha duas formas: quantidade de dias corridos
-- (contagem inicia no dia seguinte à emissão) ou data de vencimento
-- escolhida no calendário. Colunas aditivas com IF NOT EXISTS —
-- orçamentos existentes continuam funcionando sem alteração.
-- ============================================================

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS prazo_type TEXT,        -- 'dias' | 'data'
  ADD COLUMN IF NOT EXISTS prazo_dias INT,          -- prazo em dias corridos (informado ou calculado)
  ADD COLUMN IF NOT EXISTS prazo_due_date DATE;     -- data de vencimento (informada ou calculada)
