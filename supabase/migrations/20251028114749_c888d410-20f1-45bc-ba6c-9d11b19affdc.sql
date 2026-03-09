-- Fix fuel_consumed calculation in trigger function
DROP FUNCTION IF EXISTS calculate_fuel_consumption_and_tank_level() CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_fuel_consumption_and_tank_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_fuel_expense RECORD;
  v_distance_traveled NUMERIC;
  v_fuel_consumed NUMERIC;
  v_current_tank_level NUMERIC;
  v_tank_capacity NUMERIC;
BEGIN
  -- Buscar dados do veículo (capacidade do tanque e nível atual)
  SELECT 
    COALESCE(tank_capacity, 500) as tank_capacity,
    COALESCE(current_fuel_level, 0) as current_fuel_level
  INTO v_tank_capacity, v_current_tank_level
  FROM vehicles 
  WHERE id = NEW.vehicle_id;
  
  -- Armazenar nível ANTES do abastecimento
  NEW.tank_level_before := v_current_tank_level;
  
  -- Buscar último abastecimento deste veículo (com hodômetro)
  SELECT * INTO v_last_fuel_expense
  FROM fuel_expenses
  WHERE vehicle_id = NEW.vehicle_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND odometer IS NOT NULL
  ORDER BY odometer DESC, date DESC
  LIMIT 1;
  
  -- Se houver abastecimento anterior E ambos têm hodômetro
  IF v_last_fuel_expense IS NOT NULL 
     AND v_last_fuel_expense.odometer IS NOT NULL 
     AND NEW.odometer IS NOT NULL THEN
    
    -- Calcular distância percorrida
    v_distance_traveled := NEW.odometer - v_last_fuel_expense.odometer;
    NEW.distance_traveled := v_distance_traveled;
    
    -- CORREÇÃO: Calcular combustível consumido corretamente
    -- Consumo = Nível após último abastecimento - Nível antes deste abastecimento
    v_fuel_consumed := GREATEST(0, 
      COALESCE(v_last_fuel_expense.tank_level_after, v_last_fuel_expense.liters) - NEW.tank_level_before
    );
    
    NEW.fuel_consumed := v_fuel_consumed;
    
  ELSE
    -- Primeiro abastecimento ou sem hodômetro: sem dados de consumo
    NEW.fuel_consumed := NULL;
    NEW.distance_traveled := NULL;
  END IF;
  
  -- Calcular nível DEPOIS do abastecimento
  NEW.tank_level_after := LEAST(
    v_current_tank_level + NEW.liters, 
    v_tank_capacity
  );
  
  -- Atualizar nível atual do tanque no veículo
  UPDATE vehicles 
  SET 
    current_fuel_level = NEW.tank_level_after,
    fuel_level_last_updated = NEW.date
  WHERE id = NEW.vehicle_id;
  
  RETURN NEW;
END;
$function$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_fuel_consumption_calculation ON fuel_expenses;
CREATE TRIGGER trigger_fuel_consumption_calculation
  BEFORE INSERT OR UPDATE ON fuel_expenses
  FOR EACH ROW
  EXECUTE FUNCTION calculate_fuel_consumption_and_tank_level();

-- Recalculate all retroactive data
-- Step 1: Reset all calculated fields
UPDATE fuel_expenses
SET 
  fuel_consumed = NULL, 
  distance_traveled = NULL, 
  tank_level_before = NULL, 
  tank_level_after = NULL
WHERE odometer IS NOT NULL;

-- Step 2: Recalculate tank levels and consumption sequentially per vehicle
DO $$
DECLARE
  v_vehicle RECORD;
  v_expense RECORD;
  v_previous_tank_level NUMERIC;
  v_previous_odometer INTEGER;
BEGIN
  -- Process each vehicle
  FOR v_vehicle IN 
    SELECT DISTINCT vehicle_id 
    FROM fuel_expenses 
    WHERE odometer IS NOT NULL 
    ORDER BY vehicle_id
  LOOP
    v_previous_tank_level := 0;
    v_previous_odometer := 0;
    
    -- Process fuel expenses in order for this vehicle
    FOR v_expense IN
      SELECT id, liters, odometer, vehicle_id
      FROM fuel_expenses
      WHERE vehicle_id = v_vehicle.vehicle_id
        AND odometer IS NOT NULL
      ORDER BY odometer ASC, date ASC
    LOOP
      -- Update tank_level_before
      UPDATE fuel_expenses
      SET tank_level_before = v_previous_tank_level
      WHERE id = v_expense.id;
      
      -- Calculate and update tank_level_after
      UPDATE fuel_expenses
      SET tank_level_after = v_previous_tank_level + v_expense.liters
      WHERE id = v_expense.id;
      
      -- Calculate fuel_consumed (difference from previous tank_level_after)
      IF v_previous_odometer > 0 THEN
        UPDATE fuel_expenses
        SET 
          fuel_consumed = GREATEST(0, v_previous_tank_level - (
            SELECT tank_level_before 
            FROM fuel_expenses 
            WHERE id = v_expense.id
          )),
          distance_traveled = v_expense.odometer - v_previous_odometer
        WHERE id = v_expense.id;
      ELSE
        -- First fuel expense: no consumption data
        UPDATE fuel_expenses
        SET distance_traveled = NULL
        WHERE id = v_expense.id;
      END IF;
      
      -- Update previous values for next iteration
      v_previous_tank_level := v_previous_tank_level + v_expense.liters;
      v_previous_odometer := v_expense.odometer;
    END LOOP;
    
    -- Update vehicle's current_fuel_level with last tank_level_after
    UPDATE vehicles v
    SET 
      current_fuel_level = (
        SELECT tank_level_after
        FROM fuel_expenses
        WHERE vehicle_id = v_vehicle.vehicle_id
          AND odometer IS NOT NULL
        ORDER BY odometer DESC, date DESC
        LIMIT 1
      ),
      fuel_level_last_updated = (
        SELECT date
        FROM fuel_expenses
        WHERE vehicle_id = v_vehicle.vehicle_id
          AND odometer IS NOT NULL
        ORDER BY odometer DESC, date DESC
        LIMIT 1
      )
    WHERE id = v_vehicle.vehicle_id;
  END LOOP;
END $$;

-- Step 3: Recalculate vehicle consumption for all active vehicles
DO $$
DECLARE
  v_vehicle RECORD;
BEGIN
  FOR v_vehicle IN SELECT id FROM vehicles WHERE status = 'active'
  LOOP
    PERFORM calculate_vehicle_consumption(v_vehicle.id);
  END LOOP;
END $$;