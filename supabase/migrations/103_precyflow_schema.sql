-- ==============================
-- PRECYFLOW - Schema inicial
-- ==============================
-- PrecyFlow é um produto separado do Precy+ dentro do mesmo projeto Supabase:
-- reaproveita auth.users, mas tem sua própria entidade de conta/loja
-- (precyflow_stores) e tabelas próprias, todas prefixadas "precyflow_" para
-- nunca colidir com companies/products/orders etc. do Precy+. Sem relação
-- com billing/Stripe do Precy+ — ver decisão equivalente no middleware.ts.
-- Não existe módulo de Precificação aqui (regra central do escopo do PDF).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================
-- TABELA: precyflow_stores (conta/loja)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_stores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  theme TEXT DEFAULT 'cat' NOT NULL,
  theme_color TEXT DEFAULT 'rosa' NOT NULL,
  published BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT precyflow_valid_theme CHECK (theme IN ('cat','cores')),
  CONSTRAINT precyflow_valid_theme_color CHECK (theme_color IN ('rosa','azul','lilas','preto','verde','marrom'))
);

ALTER TABLE public.precyflow_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own store"
  ON public.precyflow_stores FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "precyflow public can read published stores"
  ON public.precyflow_stores FOR SELECT
  USING (published = TRUE);

-- ==============================
-- TABELA: precyflow_suppliers (fornecedores)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.precyflow_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own suppliers"
  ON public.precyflow_suppliers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- ==============================
-- TABELA: precyflow_materials (insumos)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_materials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES public.precyflow_suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'un' NOT NULL,
  cost_per_unit NUMERIC DEFAULT 0 NOT NULL,
  quantity NUMERIC DEFAULT 0 NOT NULL,
  minimum_quantity NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.precyflow_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own materials"
  ON public.precyflow_materials FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- ==============================
-- TABELA: precyflow_products (catálogo)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'geral' NOT NULL,
  sku TEXT,
  price NUMERIC DEFAULT 0 NOT NULL,
  stock_quantity NUMERIC DEFAULT 0 NOT NULL,
  minimum_quantity NUMERIC DEFAULT 0 NOT NULL,
  variations JSONB,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  show_in_storefront BOOLEAN DEFAULT TRUE NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.precyflow_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own products"
  ON public.precyflow_products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

CREATE POLICY "precyflow public can read published store products"
  ON public.precyflow_products FOR SELECT
  USING (
    is_active = TRUE AND show_in_storefront = TRUE
    AND EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.published = TRUE)
  );

-- ==============================
-- TABELA: precyflow_product_materials (produto x materiais usados)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_product_materials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.precyflow_products(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES public.precyflow_materials(id) ON DELETE CASCADE NOT NULL,
  quantity_used NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (product_id, material_id)
);

ALTER TABLE public.precyflow_product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own product_materials"
  ON public.precyflow_product_materials FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.precyflow_products p
    JOIN public.precyflow_stores s ON s.id = p.store_id
    WHERE p.id = product_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.precyflow_products p
    JOIN public.precyflow_stores s ON s.id = p.store_id
    WHERE p.id = product_id AND s.owner_id = auth.uid()
  ));

-- ==============================
-- TABELA: precyflow_customers (clientes)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.precyflow_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own customers"
  ON public.precyflow_customers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- ==============================
-- TABELA: precyflow_orders (pedidos)
-- ==============================
CREATE SEQUENCE IF NOT EXISTS precyflow_order_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.precyflow_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.precyflow_customers(id) NOT NULL,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'a_confirmar' NOT NULL,
  origin TEXT DEFAULT 'manual' NOT NULL,
  subtotal NUMERIC DEFAULT 0 NOT NULL,
  discount NUMERIC DEFAULT 0 NOT NULL,
  total NUMERIC DEFAULT 0 NOT NULL,
  notes TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT precyflow_valid_order_status CHECK (status IN ('a_confirmar','em_producao','pronto','entregue')),
  CONSTRAINT precyflow_valid_order_origin CHECK (origin IN ('manual','vitrine'))
);

ALTER TABLE public.precyflow_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own orders"
  ON public.precyflow_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- ==============================
-- TABELA: precyflow_order_items
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.precyflow_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.precyflow_products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.precyflow_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages order items via orders"
  ON public.precyflow_order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.precyflow_orders o
    JOIN public.precyflow_stores s ON s.id = o.store_id
    WHERE o.id = order_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.precyflow_orders o
    JOIN public.precyflow_stores s ON s.id = o.store_id
    WHERE o.id = order_id AND s.owner_id = auth.uid()
  ));

-- ==============================
-- TABELA: precyflow_budgets (orçamentos)
-- ==============================
CREATE SEQUENCE IF NOT EXISTS precyflow_budget_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.precyflow_budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.precyflow_customers(id) NOT NULL,
  budget_number TEXT NOT NULL,
  status TEXT DEFAULT 'rascunho' NOT NULL,
  subtotal NUMERIC DEFAULT 0 NOT NULL,
  discount NUMERIC DEFAULT 0 NOT NULL,
  total NUMERIC DEFAULT 0 NOT NULL,
  notes TEXT,
  conditions TEXT,
  valid_until TIMESTAMPTZ,
  share_token UUID DEFAULT uuid_generate_v4() NOT NULL,
  converted_to_order_id UUID REFERENCES public.precyflow_orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT precyflow_valid_budget_status CHECK (status IN ('rascunho','enviado','aprovado','recusado'))
);

ALTER TABLE public.precyflow_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own budgets"
  ON public.precyflow_budgets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- Sem policy pública de SELECT aqui: "USING (true)" vazaria TODOS os
-- orçamentos de TODAS as lojas para qualquer requisição anônima, já que
-- RLS não filtra por share_token sozinho. O link público de orçamento é
-- resolvido por uma API route com supabaseAdmin (service role), que
-- recebe o token e devolve só aquele registro — ver app/api/precyflow.

-- ==============================
-- TABELA: precyflow_budget_items
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_budget_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES public.precyflow_budgets(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.precyflow_products(id),
  description TEXT NOT NULL,
  image_url TEXT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.precyflow_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages budget items via budgets"
  ON public.precyflow_budget_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.precyflow_budgets b
    JOIN public.precyflow_stores s ON s.id = b.store_id
    WHERE b.id = budget_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.precyflow_budgets b
    JOIN public.precyflow_stores s ON s.id = b.store_id
    WHERE b.id = budget_id AND s.owner_id = auth.uid()
  ));

-- Mesmo raciocínio do precyflow_budgets: sem policy pública de SELECT,
-- o link compartilhado é resolvido via API route com service role.

-- ==============================
-- TABELA: precyflow_financial_transactions (financeiro)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_financial_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.precyflow_orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  category TEXT DEFAULT 'geral' NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  due_date TIMESTAMPTZ,
  payment_date TIMESTAMPTZ,
  payment_method TEXT,
  status TEXT DEFAULT 'pendente' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT precyflow_valid_transaction_type CHECK (type IN ('entrada','saida')),
  CONSTRAINT precyflow_valid_transaction_status CHECK (status IN ('pendente','pago','atrasado'))
);

ALTER TABLE public.precyflow_financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own transactions"
  ON public.precyflow_financial_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- ==============================
-- TABELA: precyflow_agenda_events (agenda)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_agenda_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  customer_id UUID REFERENCES public.precyflow_customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.precyflow_orders(id) ON DELETE SET NULL,
  reminder BOOLEAN DEFAULT FALSE NOT NULL,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.precyflow_agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own agenda"
  ON public.precyflow_agenda_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- ==============================
-- TABELA: precyflow_tasks (tarefas)
-- ==============================
CREATE TABLE IF NOT EXISTS public.precyflow_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id UUID REFERENCES public.precyflow_stores(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  due_date DATE,
  priority TEXT DEFAULT 'media' NOT NULL,
  status TEXT DEFAULT 'aberta' NOT NULL,
  order_id UUID REFERENCES public.precyflow_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.precyflow_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT precyflow_valid_task_priority CHECK (priority IN ('baixa','media','alta')),
  CONSTRAINT precyflow_valid_task_status CHECK (status IN ('aberta','concluida'))
);

ALTER TABLE public.precyflow_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precyflow owner manages own tasks"
  ON public.precyflow_tasks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.precyflow_stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- ==============================
-- FUNCTIONS & TRIGGERS
-- ==============================

CREATE OR REPLACE FUNCTION public.precyflow_handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER precyflow_set_updated_at_stores
  BEFORE UPDATE ON public.precyflow_stores
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_suppliers
  BEFORE UPDATE ON public.precyflow_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_materials
  BEFORE UPDATE ON public.precyflow_materials
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_products
  BEFORE UPDATE ON public.precyflow_products
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_customers
  BEFORE UPDATE ON public.precyflow_customers
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_orders
  BEFORE UPDATE ON public.precyflow_orders
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_budgets
  BEFORE UPDATE ON public.precyflow_budgets
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_transactions
  BEFORE UPDATE ON public.precyflow_financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_agenda
  BEFORE UPDATE ON public.precyflow_agenda_events
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

CREATE TRIGGER precyflow_set_updated_at_tasks
  BEFORE UPDATE ON public.precyflow_tasks
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_handle_updated_at();

-- Auto-generate order number
CREATE OR REPLACE FUNCTION public.precyflow_generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PF-' || LPAD(nextval('precyflow_order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER precyflow_set_order_number
  BEFORE INSERT ON public.precyflow_orders
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_generate_order_number();

-- Auto-generate budget number
CREATE OR REPLACE FUNCTION public.precyflow_generate_budget_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_number IS NULL OR NEW.budget_number = '' THEN
    NEW.budget_number := 'PFO-' || LPAD(nextval('precyflow_budget_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER precyflow_set_budget_number
  BEFORE INSERT ON public.precyflow_budgets
  FOR EACH ROW EXECUTE FUNCTION public.precyflow_generate_budget_number();

-- ==============================
-- INDEXES
-- ==============================
CREATE INDEX IF NOT EXISTS idx_precyflow_stores_owner_id ON public.precyflow_stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_stores_slug ON public.precyflow_stores(slug);
CREATE INDEX IF NOT EXISTS idx_precyflow_suppliers_store_id ON public.precyflow_suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_materials_store_id ON public.precyflow_materials(store_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_products_store_id ON public.precyflow_products(store_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_product_materials_product_id ON public.precyflow_product_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_customers_store_id ON public.precyflow_customers(store_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_orders_store_id ON public.precyflow_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_orders_customer_id ON public.precyflow_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_orders_status ON public.precyflow_orders(status);
CREATE INDEX IF NOT EXISTS idx_precyflow_order_items_order_id ON public.precyflow_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_budgets_store_id ON public.precyflow_budgets(store_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_budgets_share_token ON public.precyflow_budgets(share_token);
CREATE INDEX IF NOT EXISTS idx_precyflow_budget_items_budget_id ON public.precyflow_budget_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_transactions_store_id ON public.precyflow_financial_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_transactions_due_date ON public.precyflow_financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_precyflow_agenda_store_id ON public.precyflow_agenda_events(store_id);
CREATE INDEX IF NOT EXISTS idx_precyflow_agenda_date ON public.precyflow_agenda_events(event_date);
CREATE INDEX IF NOT EXISTS idx_precyflow_tasks_store_id ON public.precyflow_tasks(store_id);
