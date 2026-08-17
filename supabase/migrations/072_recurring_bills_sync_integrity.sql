-- ============================================================
-- PRECY+ — Migration 072: Integridade da geração de lançamentos
-- a partir de Contas Recorrentes
-- ============================================================
-- Contexto do bug corrigido no app (ver lib/finance/recurringBillsSync.ts):
-- a geração "lazy" de financial_transactions a partir de recurring_bills
-- só disparava quando o vencimento já tinha passado (isPast) e apenas
-- dentro da aba "Contas Recorrentes" de Financeiro Avançado — por isso
-- contas com vencimento ainda dentro do mês corrente nunca chegavam ao
-- Financeiro. O app agora sincroniza globalmente, ao abrir o sistema,
-- assim que o período de competência começa.
--
-- Esta migration garante a integridade correspondente no banco.
-- ============================================================

-- ── recurring_bills.type: coluna já existe em produção (adicionada fora
--    do fluxo de migrations); sincroniza o schema versionado com a
--    realidade do banco, sem efeito em bancos já corretos. ──
ALTER TABLE public.recurring_bills
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';

ALTER TABLE public.recurring_bills
  DROP CONSTRAINT IF EXISTS recurring_bills_type_check;
ALTER TABLE public.recurring_bills
  ADD CONSTRAINT recurring_bills_type_check CHECK (type IN ('income', 'expense'));

-- ── Trava de duplicidade no banco: nunca pode existir mais de um
--    lançamento financeiro para a mesma conta recorrente na mesma data
--    de competência — mesmo sob concorrência (duas abas abertas, retry,
--    StrictMode). NULLs (lançamentos manuais, sem recurring_bill_id) não
--    conflitam entre si, então lançamentos manuais não são afetados. ──
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS uq_financial_transactions_recurring_date;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT uq_financial_transactions_recurring_date UNIQUE (recurring_bill_id, date);
