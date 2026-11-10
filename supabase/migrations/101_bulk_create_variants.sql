-- ============================================================
-- PRECY+ — Migration 101: Criação em massa de combinações (Excel "Modo B")
-- ============================================================
-- Cria várias combinações (product_variants + product_variant_option_values)
-- de uma vez, a partir da planilha de criação em massa (Produtos →
-- Variações → "Importar Excel (criar combinações)"). Só CRIA — nunca
-- atualiza ou apaga combinações existentes; não cria grupos nem opções
-- novos, só usa os que o produto já tem (option_id já resolvido por quem
-- chama, contra os grupos/opções atuais do produto).
--
-- Transacional: qualquer EXCEPTION (produto de outra empresa, option_id que
-- não existe mais, preço negativo) desfaz TODAS as combinações já inseridas
-- nesta chamada — nunca uma criação parcial.
CREATE OR REPLACE FUNCTION public.bulk_create_variants(
  p_product_id UUID,
  p_company_id UUID,
  p_rows       JSONB
  -- [{ "price": 35.00, "sku"?: "...", "stock_quantity"?: 5, "lead_time_days"?: 3,
  --    "weight_kg"?: 0.2, "options": [{ "group_id": "<uuid>", "option_id": "<uuid>" }, ...] }, ...]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       JSONB;
  v_opt       JSONB;
  v_price     NUMERIC;
  v_new_id    UUID;
  v_created   INT := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows precisa ser um array JSON de combinações';
  END IF;

  PERFORM 1 FROM public.products WHERE id = p_product_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto % não encontrado para a empresa informada', p_product_id;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    IF (v_row->>'price') IS NULL THEN
      RAISE EXCEPTION 'Linha sem preço-base';
    END IF;
    v_price := (v_row->>'price')::NUMERIC;
    IF v_price < 0 THEN
      RAISE EXCEPTION 'Preço negativo não é permitido';
    END IF;

    INSERT INTO public.product_variants (
      product_id, company_id, price, sku, stock_quantity, lead_time_days, weight_kg
    ) VALUES (
      p_product_id, p_company_id, v_price,
      NULLIF(v_row->>'sku', ''),
      CASE WHEN v_row ? 'stock_quantity' THEN (v_row->>'stock_quantity')::INT ELSE NULL END,
      CASE WHEN v_row ? 'lead_time_days' THEN (v_row->>'lead_time_days')::INT ELSE NULL END,
      CASE WHEN v_row ? 'weight_kg' THEN (v_row->>'weight_kg')::NUMERIC ELSE NULL END
    )
    RETURNING id INTO v_new_id;

    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_row->'options', '[]'::jsonb))
    LOOP
      INSERT INTO public.product_variant_option_values (variant_id, option_id, group_id)
      VALUES (v_new_id, (v_opt->>'option_id')::UUID, (v_opt->>'group_id')::UUID);
    END LOOP;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;

COMMENT ON FUNCTION public.bulk_create_variants IS
  'Cria em lote e de forma transacional novas combinações (product_variants + product_variant_option_values) a partir da planilha de criação em massa. Nunca atualiza/apaga combinações existentes nem cria grupos/opções.';
