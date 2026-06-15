-- ============================================================
-- PRECY+ — Migration 023: Recalculo automático de produtos
-- quando custo de material (inventory) é atualizado
-- ============================================================
-- FUNCIONAMENTO:
--   Trigger AFTER UPDATE ON inventory
--   Quando cost_per_unit muda → atualiza product_materials
--   que referenciam esse inventory_id → recalcula products
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_product_costs_on_inventory_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r                   RECORD;
  new_material_cost   NUMERIC;
  new_total_cost      NUMERIC;
  new_final_price     NUMERIC;
  v_labor_cost        NUMERIC;
  v_extra_cost        NUMERIC;
  v_markup            NUMERIC;
BEGIN
  -- Só age quando cost_per_unit realmente mudou
  IF OLD.cost_per_unit IS NOT DISTINCT FROM NEW.cost_per_unit THEN
    RETURN NEW;
  END IF;

  -- 1. Atualizar unit_cost e subtotal em product_materials que referenciam esse item
  UPDATE public.product_materials
  SET
    unit_cost = NEW.cost_per_unit,
    subtotal  = quantity * NEW.cost_per_unit
  WHERE inventory_id = NEW.id;

  -- 2. Para cada produto afetado, recalcular material_cost e propagar
  FOR r IN
    SELECT DISTINCT pm.product_id
    FROM public.product_materials pm
    WHERE pm.inventory_id = NEW.id
  LOOP
    -- Somar todos os subtotais dos materiais desse produto
    SELECT COALESCE(SUM(subtotal), 0)
    INTO new_material_cost
    FROM public.product_materials
    WHERE product_id = r.product_id;

    -- Buscar labor_cost, extra_cost e markup do produto
    SELECT
      COALESCE(labor_cost, 0),
      COALESCE(extra_cost, 0),
      COALESCE(markup_percentage, 100)
    INTO v_labor_cost, v_extra_cost, v_markup
    FROM public.products
    WHERE id = r.product_id;

    -- Calcular novo total_cost e final_price
    new_total_cost  := new_material_cost + v_labor_cost + v_extra_cost;
    new_final_price := new_total_cost * (1.0 + v_markup / 100.0);

    -- Atualizar o produto
    UPDATE public.products
    SET
      material_cost = new_material_cost,
      total_cost    = new_total_cost,
      final_price   = new_final_price,
      updated_at    = NOW()
    WHERE id = r.product_id;

  END LOOP;

  RETURN NEW;
END;
$$;

-- Dropar trigger anterior se existir
DROP TRIGGER IF EXISTS trg_sync_product_costs ON public.inventory;

-- Criar trigger AFTER UPDATE
CREATE TRIGGER trg_sync_product_costs
  AFTER UPDATE OF cost_per_unit ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_costs_on_inventory_update();

-- Índice para acelerar o lookup por inventory_id
CREATE INDEX IF NOT EXISTS idx_product_materials_inventory_id
  ON public.product_materials(inventory_id);
