-- ============================================================
-- PRECY+ — Migration 098: Atualização em lote de vários campos das variações
-- ============================================================
-- Evolui bulk_update_variant_prices (migration 089): em vez de só `price`,
-- atualiza qualquer subconjunto de {price, sku, stock_quantity,
-- lead_time_days, weight_kg, is_active} por combinação, de forma transacional
-- — qualquer EXCEPTION desfaz TODAS as atualizações já feitas nesta chamada
-- (nunca atualização parcial). Usado pela importação de planilha Excel das
-- variações (Produtos → Variações → Importar Excel), que agora permite
-- editar todos esses campos, não só o preço.
--
-- Cada item de p_updates só precisa trazer os campos que de fato mudaram —
-- a função usa `jsonb ? 'campo'` pra distinguir "campo não veio" (mantém o
-- valor atual) de "campo veio" (mesmo que null, quando a coluna aceita
-- null). Não cria, não apaga e não altera grupos/opções/combinações — só os
-- campos acima de combinações já existentes.
--
-- bulk_update_variant_prices (089) continua existindo, inalterada —
-- qualquer código antigo que a chame continua funcionando.
-- ============================================================

CREATE OR REPLACE FUNCTION public.bulk_update_variant_fields(
  p_product_id UUID,
  p_company_id UUID,
  p_updates    JSONB -- [{ "id": "<uuid>", "price"?: 10, "sku"?: "...", "stock_quantity"?: 5, "lead_time_days"?: 3, "weight_kg"?: 0.2, "is_active"?: true }, ...]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    JSONB;
  v_id      UUID;
  v_updated INT := 0;
  v_rows    INT;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'p_updates precisa ser um array JSON de atualizações';
  END IF;

  -- Confirma que o produto pertence à empresa informada antes de tocar em qualquer linha.
  PERFORM 1 FROM public.products WHERE id = p_product_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto % não encontrado para a empresa informada', p_product_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    IF (v_item->>'id') IS NULL THEN
      RAISE EXCEPTION 'Linha de atualização sem id de combinação';
    END IF;
    v_id := (v_item->>'id')::UUID;

    IF v_item ? 'price' AND (v_item->>'price')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Preço negativo não é permitido (combinação %)', v_id;
    END IF;
    IF v_item ? 'stock_quantity' AND v_item->>'stock_quantity' IS NOT NULL AND (v_item->>'stock_quantity')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Estoque negativo não é permitido (combinação %)', v_id;
    END IF;
    IF v_item ? 'lead_time_days' AND v_item->>'lead_time_days' IS NOT NULL AND (v_item->>'lead_time_days')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Prazo negativo não é permitido (combinação %)', v_id;
    END IF;
    IF v_item ? 'weight_kg' AND v_item->>'weight_kg' IS NOT NULL AND (v_item->>'weight_kg')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Peso negativo não é permitido (combinação %)', v_id;
    END IF;

    UPDATE public.product_variants SET
      price          = CASE WHEN v_item ? 'price'          THEN (v_item->>'price')::NUMERIC  ELSE price          END,
      sku            = CASE WHEN v_item ? 'sku'            THEN NULLIF(v_item->>'sku', '')    ELSE sku            END,
      stock_quantity = CASE WHEN v_item ? 'stock_quantity' THEN (v_item->>'stock_quantity')::INT ELSE stock_quantity END,
      lead_time_days = CASE WHEN v_item ? 'lead_time_days' THEN (v_item->>'lead_time_days')::INT ELSE lead_time_days END,
      weight_kg      = CASE WHEN v_item ? 'weight_kg'      THEN (v_item->>'weight_kg')::NUMERIC ELSE weight_kg      END,
      is_active      = CASE WHEN v_item ? 'is_active'      THEN (v_item->>'is_active')::BOOLEAN ELSE is_active      END,
      updated_at = NOW()
    WHERE id = v_id AND product_id = p_product_id AND company_id = p_company_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Combinação % não encontrada neste produto', v_id;
    END IF;

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.bulk_update_variant_fields IS
  'Atualiza em lote e de forma transacional um subconjunto de campos (price, sku, stock_quantity, lead_time_days, weight_kg, is_active) de combinações de um produto. Usado pela importação de planilha Excel das variações — substitui bulk_update_variant_prices (089) nesse fluxo, que segue existindo por compatibilidade.';
