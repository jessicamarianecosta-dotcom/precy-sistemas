-- ============================================================
-- PRECY+ — Migration 056: Dependência entre opções de variação
-- ============================================================
-- Hoje o VariationsEditor gera produto cartesiano completo de todas as
-- opções de todos os grupos (ex: "Triplex 180g", que não existe na
-- realidade — Triplex só existe em 300g). O schema já suportava guardar
-- só um subconjunto de combinações (product_variants + a junção
-- product_variant_option_values não forçam cartesiano); o problema estava
-- 100% na lógica do editor, que resincronizava (insert+delete) o cartesiano
-- inteiro a cada mudança.
--
-- Esta tabela guarda regras de dependência ENTRE OPÇÕES (não entre grupos
-- fixos) — funciona para qualquer número/nome de grupos que o produto
-- tenha. Uma opção sem nenhuma linha aqui é sempre permitida (100%
-- compatível com produtos antigos, que não têm nenhuma regra). Uma opção
-- com 1+ linhas só é permitida quando pelo menos uma das opções-pai já foi
-- selecionada (semântica OU entre múltiplos pais — cobre "Frente e verso"
-- habilitado por 230g OU 300g). Uma opção pode depender de uma opção de
-- QUALQUER grupo anterior, não só do grupo imediatamente anterior (ex:
-- Acabamento pode depender de Gramatura, pulando Impressão).
-- ============================================================

CREATE TABLE public.product_variation_dependencies (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id           UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  company_id           UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  option_id            UUID REFERENCES public.product_variation_options(id) ON DELETE CASCADE NOT NULL,
  depends_on_option_id UUID REFERENCES public.product_variation_options(id) ON DELETE CASCADE NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (option_id, depends_on_option_id),
  CHECK (option_id <> depends_on_option_id)
);

CREATE INDEX idx_pvd_product ON public.product_variation_dependencies(product_id);
CREATE INDEX idx_pvd_option ON public.product_variation_dependencies(option_id);
CREATE INDEX idx_pvd_depends_on ON public.product_variation_dependencies(depends_on_option_id);

ALTER TABLE public.product_variation_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_variation_dependencies_tenant" ON public.product_variation_dependencies FOR ALL
  USING   (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Leitura pública necessária para a página da loja desabilitar, no seletor
-- de variação, as opções que levariam a uma combinação inexistente.
CREATE POLICY "product_variation_dependencies_public_read" ON public.product_variation_dependencies FOR SELECT
  TO anon
  USING (
    public.company_has_catalog_access(company_id)
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.is_published_catalog = true
    )
  );
