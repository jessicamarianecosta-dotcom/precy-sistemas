-- ============================================================
-- PRECY+ — Migration 044: Biblioteca Precy+ (produtos prontos p/ importação)
-- ============================================================
-- Tabela GLOBAL (sem company_id) — catálogo oficial compartilhado por
-- todas as empresas. Leitura liberada a qualquer usuário autenticado;
-- escrita restrita a usuários com companies.role = 'developer'.
-- Produtos importados são copiados para `products` e nunca ficam
-- vinculados de volta a este registro (library_source_id é só metadado).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.library_products (
  id                       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_group           TEXT NOT NULL,
  subcategory              TEXT NOT NULL,
  name                     TEXT NOT NULL,
  description              TEXT,
  photos                   JSONB DEFAULT '[]' NOT NULL,
  suggested_price          NUMERIC(12,2),
  suggested_lead_time_days INT,
  is_active                BOOLEAN DEFAULT true NOT NULL,
  created_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (category_group, subcategory)
);

ALTER TABLE public.library_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_products_read" ON public.library_products;
CREATE POLICY "library_products_read" ON public.library_products FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "library_products_write_developer" ON public.library_products;
CREATE POLICY "library_products_write_developer" ON public.library_products FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.user_id = auth.uid() AND c.role = 'developer')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.user_id = auth.uid() AND c.role = 'developer')
  );

CREATE INDEX IF NOT EXISTS idx_library_products_group ON public.library_products(category_group, subcategory);

-- ── Seed: 1 produto placeholder por subcategoria do briefing ──
-- Fotos ficam vazias (JSONB '[]') — a empresa/dev substitui depois pelo
-- painel administrativo por dados/imagens reais.
INSERT INTO public.library_products (category_group, subcategory, name, description, suggested_price, suggested_lead_time_days)
VALUES
  -- Comunicação Visual
  ('Comunicação Visual', 'Banner',                'Banner Padrão',                 'Banner em lona 440g, acabamento com ilhós.',            120.00, 3),
  ('Comunicação Visual', 'Faixa',                  'Faixa Promocional',             'Faixa em lona para divulgação externa.',                 90.00, 3),
  ('Comunicação Visual', 'Lona',                    'Lona 440g',                     'Lona impressa em alta resolução, sob medida.',           35.00, 3),
  ('Comunicação Visual', 'Adesivo Vinil',           'Adesivo Vinil Recortado',        'Adesivo em vinil com recorte eletrônico.',                25.00, 2),
  ('Comunicação Visual', 'Adesivo Transparente',    'Adesivo Transparente',           'Adesivo em vinil transparente para vidros.',              28.00, 2),
  ('Comunicação Visual', 'Adesivo Perfurado',       'Adesivo Perfurado (One Way)',    'Adesivo perfurado para vitrines, visão de dentro pra fora.', 45.00, 3),
  ('Comunicação Visual', 'Placa PVC',               'Placa em PVC',                   'Placa em PVC 3mm ou 5mm, diversos tamanhos.',             60.00, 4),
  ('Comunicação Visual', 'Placa ACM',               'Placa em ACM',                   'Placa em alumínio composto, alta durabilidade.',          150.00, 5),
  ('Comunicação Visual', 'Backdrop',                'Backdrop para Eventos',          'Painel de fundo para fotos e eventos.',                   250.00, 5),
  ('Comunicação Visual', 'Wind Banner',             'Wind Banner',                    'Banner tipo pena/wind com haste e base.',                180.00, 5),
  ('Comunicação Visual', 'Totem',                   'Totem Promocional',              'Totem autoportante para ponto de venda.',                350.00, 7),
  ('Comunicação Visual', 'Display',                 'Display de Balcão',              'Display promocional para balcão/PDV.',                    80.00, 4),
  ('Comunicação Visual', 'Plotagem',                'Plotagem de Veículo',            'Plotagem parcial ou total de veículos.',                 800.00, 7),
  ('Comunicação Visual', 'Envelopamento',           'Envelopamento Adesivo',          'Envelopamento de superfícies com vinil adesivo.',        900.00, 7),
  ('Comunicação Visual', 'Letra Caixa',             'Letra Caixa',                    'Letreiro em letra caixa iluminada ou não.',              200.00, 10),
  ('Comunicação Visual', 'Fachadas',                'Fachada Comercial',              'Projeto e instalação de fachada completa.',             1200.00, 15),
  -- Papelaria
  ('Papelaria', 'Cartão de Visita',   'Cartão de Visita',        'Cartão de visita em papel couché 300g.',       0.50, 3),
  ('Papelaria', 'Panfleto',           'Panfleto A5',              'Panfleto colorido frente e verso.',            0.30, 3),
  ('Papelaria', 'Folder',             'Folder Institucional',     'Folder dobrado, alta qualidade de impressão.', 1.20, 4),
  ('Papelaria', 'Flyer',              'Flyer Promocional',        'Flyer para divulgação de eventos/promoções.',  0.35, 3),
  ('Papelaria', 'Tag',                'Tag para Produtos',        'Etiqueta pendurável para produtos.',           0.40, 3),
  ('Papelaria', 'Etiqueta',           'Etiqueta Adesiva',         'Etiqueta adesiva personalizada.',              0.25, 3),
  ('Papelaria', 'Bloco',              'Bloco de Anotações',       'Bloco personalizado 50 folhas.',               8.00, 4),
  ('Papelaria', 'Agenda',             'Agenda Personalizada',     'Agenda anual personalizada com capa dura.',   35.00, 7),
  ('Papelaria', 'Planner',            'Planner Personalizado',    'Planner semanal/mensal personalizado.',        30.00, 7),
  ('Papelaria', 'Calendário',         'Calendário Personalizado', 'Calendário de mesa ou parede.',                12.00, 5),
  ('Papelaria', 'Papel Timbrado',     'Papel Timbrado',           'Papel timbrado personalizado, resma de 100.',  0.60, 3),
  ('Papelaria', 'Envelope',           'Envelope Personalizado',   'Envelope personalizado tamanho ofício.',       1.00, 4),
  ('Papelaria', 'Pasta',              'Pasta Personalizada',      'Pasta institucional com elástico.',            6.00, 5),
  -- Personalizados
  ('Personalizados', 'Caneca',        'Caneca Personalizada',     'Caneca de cerâmica com estampa sublimada.',   25.00, 4),
  ('Personalizados', 'Camiseta',      'Camiseta Personalizada',   'Camiseta 100% algodão com estampa.',          45.00, 5),
  ('Personalizados', 'Ecobag',        'Ecobag Personalizada',     'Sacola de tecido personalizada.',             20.00, 5),
  ('Personalizados', 'Chaveiro',      'Chaveiro Personalizado',   'Chaveiro em acrílico ou metal.',              12.00, 3),
  ('Personalizados', 'Copo',          'Copo Personalizado',       'Copo plástico ou acrílico personalizado.',    15.00, 4),
  ('Personalizados', 'Garrafa',       'Garrafa Personalizada',    'Garrafa squeeze personalizada.',              30.00, 5),
  ('Personalizados', 'Almofada',      'Almofada Personalizada',   'Almofada com estampa sublimada.',             35.00, 5),
  ('Personalizados', 'Mouse Pad',     'Mouse Pad Personalizado',  'Mouse pad emborrachado personalizado.',       18.00, 4),
  ('Personalizados', 'Azulejo',       'Azulejo Personalizado',    'Azulejo decorativo com foto/estampa.',        22.00, 5),
  ('Personalizados', 'Quebra-cabeça', 'Quebra-cabeça Personalizado','Quebra-cabeça com foto personalizada.',     28.00, 5),
  -- Brindes
  ('Brindes', 'Squeeze',              'Squeeze Personalizado',           'Squeeze plástico com logo.',           18.00, 5),
  ('Brindes', 'Caneta',               'Caneta Personalizada',            'Caneta esferográfica com logo.',        2.50, 4),
  ('Brindes', 'Agenda Corporativa',   'Agenda Corporativa',              'Agenda anual para brindes corporativos.', 32.00, 7),
  ('Brindes', 'Bloco Corporativo',    'Bloco Corporativo',               'Bloco de anotações corporativo.',        7.00, 4),
  ('Brindes', 'Chaveiro',             'Chaveiro Brinde',                 'Chaveiro promocional em metal/acrílico.', 10.00, 3),
  ('Brindes', 'Porta-copos',          'Porta-copos Personalizado',       'Jogo de porta-copos personalizado.',     14.00, 4),
  ('Brindes', 'Kit Presente',         'Kit Presente Corporativo',        'Kit brinde corporativo com itens variados.', 60.00, 7),
  -- Embalagens
  ('Embalagens', 'Caixa Personalizada',        'Caixa Personalizada',        'Caixa de papelão personalizada.',       4.00, 5),
  ('Embalagens', 'Sacola',                     'Sacola Personalizada',       'Sacola de papel ou plástico personalizada.', 2.50, 4),
  ('Embalagens', 'Rótulo',                     'Rótulo Personalizado',       'Rótulo adesivo para embalagens.',        0.30, 3),
  ('Embalagens', 'Lacre',                      'Lacre Personalizado',        'Lacre adesivo de segurança/identidade.', 0.20, 3),
  ('Embalagens', 'Adesivo para embalagem',     'Adesivo para Embalagem',     'Adesivo personalizado para fechamento de embalagens.', 0.25, 3)
ON CONFLICT (category_group, subcategory) DO NOTHING;
