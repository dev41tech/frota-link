-- ============================================================================
-- FASE 1: RECRIAR TRIGGERS ESSENCIAIS
-- ============================================================================

-- 1. Recriar função de validação de hodômetro
CREATE OR REPLACE FUNCTION public.validate_odometer_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_last_odometer INTEGER;
BEGIN
  -- Se não informou hodômetro, permite (campo opcional)
  IF NEW.odometer IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar último hodômetro registrado deste veículo
  SELECT MAX(odometer) INTO v_last_odometer
  FROM fuel_expenses
  WHERE vehicle_id = NEW.vehicle_id
    AND odometer IS NOT NULL
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Se houver hodômetro anterior, validar sequência
  IF v_last_odometer IS NOT NULL AND NEW.odometer <= v_last_odometer THEN
    RAISE EXCEPTION 'Hodômetro inválido: % km. O último hodômetro registrado foi % km. Informe um valor maior.', 
      NEW.odometer, v_last_odometer
    USING HINT = 'O hodômetro deve ser sempre crescente para cada veículo.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Recriar trigger de validação
DROP TRIGGER IF EXISTS trigger_validate_odometer ON fuel_expenses;
CREATE TRIGGER trigger_validate_odometer
  BEFORE INSERT OR UPDATE OF odometer ON fuel_expenses
  FOR EACH ROW
  EXECUTE FUNCTION validate_odometer_sequence();

-- 3. Recriar função de cálculo de consumo e nível do tanque
CREATE OR REPLACE FUNCTION public.calculate_fuel_consumption_and_tank_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    
    -- Calcular combustível consumido
    v_fuel_consumed := GREATEST(0, 
      COALESCE(v_last_fuel_expense.tank_level_after, v_last_fuel_expense.liters) - v_current_tank_level
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
$$;

-- 4. Recriar trigger de cálculo
DROP TRIGGER IF EXISTS trigger_calculate_fuel_consumption ON fuel_expenses;
CREATE TRIGGER trigger_calculate_fuel_consumption
  BEFORE INSERT ON fuel_expenses
  FOR EACH ROW
  EXECUTE FUNCTION calculate_fuel_consumption_and_tank_level();

-- ============================================================================
-- FASE 2: RESTAURAR DADOS DEMO
-- ============================================================================

-- Criar dados DEMO para a conta de demonstração
DO $$
DECLARE
  v_demo_company_id uuid;
  v_demo_vehicle_id uuid;
  v_demo_driver_id uuid;
  v_demo_user_id uuid;
  v_journey1_id uuid;
  v_journey2_id uuid;
BEGIN
  -- Buscar IDs da conta DEMO
  SELECT id INTO v_demo_company_id 
  FROM companies 
  WHERE cnpj = '00000000000191' OR name ILIKE '%demo%' 
  LIMIT 1;
  
  IF v_demo_company_id IS NULL THEN
    RAISE NOTICE 'Empresa DEMO não encontrada. Pulando criação de dados.';
    RETURN;
  END IF;
  
  -- Buscar veículo DEMO
  SELECT id INTO v_demo_vehicle_id 
  FROM vehicles 
  WHERE company_id = v_demo_company_id 
  LIMIT 1;
  
  -- Buscar motorista DEMO
  SELECT id INTO v_demo_driver_id 
  FROM drivers 
  WHERE company_id = v_demo_company_id 
  LIMIT 1;
  
  -- Buscar usuário DEMO
  SELECT user_id INTO v_demo_user_id 
  FROM profiles 
  WHERE company_id = v_demo_company_id 
  LIMIT 1;
  
  IF v_demo_vehicle_id IS NULL OR v_demo_driver_id IS NULL OR v_demo_user_id IS NULL THEN
    RAISE NOTICE 'Dados básicos DEMO incompletos. Pulando criação de jornadas.';
    RETURN;
  END IF;
  
  -- Criar Jornada 1: São Paulo -> Rio de Janeiro (CONCLUÍDA)
  INSERT INTO journeys (
    company_id, vehicle_id, driver_id, user_id,
    journey_number, origin, destination,
    start_date, end_date, start_km, end_km,
    distance, freight_value, status
  ) VALUES (
    v_demo_company_id, v_demo_vehicle_id, v_demo_driver_id, v_demo_user_id,
    'VG-001', 'São Paulo - SP', 'Rio de Janeiro - RJ',
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days',
    10000, 10450, 450, 5000.00, 'completed'
  ) RETURNING id INTO v_journey1_id;
  
  -- Abastecimento 1 da Jornada 1 (Início - São Paulo)
  INSERT INTO fuel_expenses (
    company_id, vehicle_id, user_id, journey_id,
    date, odometer, liters, price_per_liter, total_amount,
    payment_method, notes
  ) VALUES (
    v_demo_company_id, v_demo_vehicle_id, v_demo_user_id, v_journey1_id,
    NOW() - INTERVAL '10 days', 10000, 150, 5.50, 825.00,
    'card', 'Abastecimento inicial - SP'
  );
  
  -- Abastecimento 2 da Jornada 1 (Meio do caminho)
  INSERT INTO fuel_expenses (
    company_id, vehicle_id, user_id, journey_id,
    date, odometer, liters, price_per_liter, total_amount,
    payment_method, notes
  ) VALUES (
    v_demo_company_id, v_demo_vehicle_id, v_demo_user_id, v_journey1_id,
    NOW() - INTERVAL '9 days', 10200, 80, 5.70, 456.00,
    'card', 'Abastecimento no meio - Via Dutra'
  );
  
  -- Receita da Jornada 1
  INSERT INTO revenue (
    company_id, journey_id, user_id,
    description, amount, date,
    client, payment_method, status
  ) VALUES (
    v_demo_company_id, v_journey1_id, v_demo_user_id,
    'Frete São Paulo - Rio de Janeiro', 5000.00, NOW() - INTERVAL '8 days',
    'Distribuidora ABC Ltda', 'bank_transfer', 'received'
  );
  
  -- Criar Jornada 2: Campinas -> Santos (CONCLUÍDA)
  INSERT INTO journeys (
    company_id, vehicle_id, driver_id, user_id,
    journey_number, origin, destination,
    start_date, end_date, start_km, end_km,
    distance, freight_value, status
  ) VALUES (
    v_demo_company_id, v_demo_vehicle_id, v_demo_driver_id, v_demo_user_id,
    'VG-002', 'Campinas - SP', 'Santos - SP',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days',
    10450, 10650, 200, 2500.00, 'completed'
  ) RETURNING id INTO v_journey2_id;
  
  -- Abastecimento da Jornada 2
  INSERT INTO fuel_expenses (
    company_id, vehicle_id, user_id, journey_id,
    date, odometer, liters, price_per_liter, total_amount,
    payment_method, notes
  ) VALUES (
    v_demo_company_id, v_demo_vehicle_id, v_demo_user_id, v_journey2_id,
    NOW() - INTERVAL '5 days', 10450, 60, 5.60, 336.00,
    'card', 'Abastecimento Campinas'
  );
  
  -- Receita da Jornada 2
  INSERT INTO revenue (
    company_id, journey_id, user_id,
    description, amount, date,
    client, payment_method, status
  ) VALUES (
    v_demo_company_id, v_journey2_id, v_demo_user_id,
    'Frete Campinas - Santos', 2500.00, NOW() - INTERVAL '4 days',
    'Porto XYZ S.A.', 'bank_transfer', 'received'
  );
  
  RAISE NOTICE 'Dados DEMO restaurados com sucesso!';
  RAISE NOTICE 'Jornadas criadas: %, %', v_journey1_id, v_journey2_id;
END $$;