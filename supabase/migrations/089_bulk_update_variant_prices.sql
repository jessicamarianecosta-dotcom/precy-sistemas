-- ============================================================
-- PRECY+ — Migration 089: Atualização em lote do preço-base das variações
-- ============================================================
-- Função usada pela importação de planilha Excel (Produtos → Variações →
-- Importar Excel): atualiza o preço-base (product_variants.price) de várias
-- combinações de uma vez, de forma TRANSACIONAL — o corpo de uma função
-- PL/pgSQL roda dentro da transação de quem chama; qualquer EXCEPTION não
-- tratada desfaz TODAS as atualizações já feitas nesta chamada (nunca
-- atualização parcial).
--
-- Não cria, não apaga e não altera grupos/opções/combinações — só o campo
-- `price`. Nunca mexe em acréscimo fixo/percentual das opções: o preço
-- final continua sendo calculado em tempo real por calcOptionsAdjustment()
-- a partir do preço-base atualizado aqui + os acréscimos já cadastrados.
-- ============================================================

CREATE OR REPLACE FUNCTION public.bulk_update_variant_prices(
  p_product_id UUID,
  p_company_id UUID,
  p_updates    JSONB -- [{ "id": "<variant uuid>", "price": 55.00 }, ...]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    JSONB;
  v_id      UUID;
  v_price   NUMERIC;
  v_updated INT := 0;
  v_rows    INT;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'p_updates precisa ser um array JSON de {id, price}';
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

    IF (v_item->>'price') IS NULL THEN
      RAISE EXCEPTION 'Linha de atualização sem preço (combinação %)', v_id;
    END IF;
    v_price := (v_item->>'price')::NUMERIC;

    IF v_price < 0 THEN
      RAISE EXCEPTION 'Preço negativo não é permitido (combinação %)', v_id;
    END IF;

    UPDATE public.product_variants
       SET price = v_price, updated_at = NOW()
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

COMMENT ON FUNCTION public.bulk_update_variant_prices IS
  'Atualiza em lote e de forma transacional o preço-base (price) de combinações de um produto. Usado pela importação de planilha Excel das variações.';
