-- ============================================================
-- PRECY+ — Migration 025: Centro de Custos (Financeiro Avançado)
-- ============================================================
-- Módulo 1/8 do Financeiro Avançado (acesso PRO).
-- Permite criar categorias de custo customizadas, vinculadas a
-- lançamentos em financial_transactions via cost_center_id.
-- ============================================================

-- ── 1. Tabela cost_centers ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id  UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#8B6C4F' NOT NULL,
  icon        TEXT DEFAULT '📊' NOT NULL,
  is_default  BOOLEAN DEFAULT FALSE NOT NULL,  -- categorias padrão do sistema (não deletáveis)
  is_active   BOOLEAN DEFAULT TRUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (company_id, name)
);

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cost_centers_tenant" ON public.cost_centers;
CREATE POLICY "cost_centers_tenant" ON public.cost_centers FOR ALL
  USING      (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON public.cost_centers(company_id);

-- ── 2. Vincular financial_transactions a um centro de custo ─
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_cost_center
  ON public.financial_transactions(cost_center_id);

-- ── 3. Função: criar centros de custo padrão para uma empresa ──
-- Chamada manualmente ou via trigger no cadastro da empresa.
CREATE OR REPLACE FUNCTION public.seed_default_cost_centers(p_company_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cost_centers (company_id, name, color, icon, is_default)
  VALUES
    (p_company_id, 'Matéria-prima', '#B45309', '📦', TRUE),
    (p_company_id, 'Marketing',     '#7C3AED', '📣', TRUE),
    (p_company_id, 'Energia',       '#D97706', '⚡', TRUE),
    (p_company_id, 'Água',          '#0891B2', '💧', TRUE),
    (p_company_id, 'Internet',      '#2563EB', '🌐', TRUE),
    (p_company_id, 'Aluguel',       '#DC2626', '🏠', TRUE),
    (p_company_id, 'Pró-labore',    '#059669', '💰', TRUE),
    (p_company_id, 'Impostos',      '#4B5563', '📋', TRUE),
    (p_company_id, 'Equipamentos',  '#9333EA', '🛠️', TRUE),
    (p_company_id, 'Transporte',    '#0D9488', '🚗', TRUE),
    (p_company_id, 'Investimentos', '#1D4ED8', '📈', TRUE)
  ON CONFLICT (company_id, name) DO NOTHING;
END;
$$;
