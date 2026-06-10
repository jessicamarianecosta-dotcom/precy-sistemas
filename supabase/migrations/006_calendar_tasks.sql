-- ============================================================
-- PRECY+ — Migration 006: Tabela calendar_tasks
-- ============================================================
-- Execute no SQL Editor do painel Supabase:
-- https://app.supabase.com → SQL Editor → New Query → Paste → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.calendar_tasks (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id       UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  date             DATE NOT NULL,
  time             TIME,
  priority         TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  category         TEXT DEFAULT 'task' CHECK (category IN ('task','production','delivery','meeting','financial','personal','reminder')),
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
  notes            TEXT,
  linked_order_id  UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar tasks"
  ON public.calendar_tasks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_company_date
  ON public.calendar_tasks(company_id, date);

