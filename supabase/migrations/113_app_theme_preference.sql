-- ============================================================
-- PRECY+ — Migration 113: Preferência de tema da interface (Aparência)
-- ============================================================
-- Execute no SQL Editor do painel Supabase:
-- https://app.supabase.com → SQL Editor → New Query → Paste → Run
-- ============================================================
-- Guarda a paleta de cor escolhida em Configurações > Aparência.
-- Disponível tanto no Precy Essencial quanto no Precy Pro — não é
-- uma feature de plano, por isso não há checagem de assinatura aqui.
--
-- Independente de companies.primary_color/secondary_color (migration 005),
-- que são a cor de marca aplicada nos PDFs de orçamento e não mudam com
-- o tema da interface.
--
-- O modo claro/escuro continua resolvido só no cliente (next-themes +
-- localStorage), como já era antes desta migration — não precisa de
-- coluna própria.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ui_theme_palette TEXT NOT NULL DEFAULT 'classico';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_ui_theme_palette_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_ui_theme_palette_check
  CHECK (ui_theme_palette IN ('classico', 'rosa', 'verde', 'azul', 'roxo', 'grafite'));
