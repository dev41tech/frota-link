-- Calcular fuel_consumed e distance_traveled para dados existentes retroativamente
-- Este UPDATE calcula os valores para registros que já existem mas não têm esses dados

UPDATE fuel_expenses fe1
SET 
  distance_traveled = (
    SELECT fe1.odometer - MAX(fe2.odometer)
    FROM fuel_expenses fe2
    WHERE fe2.vehicle_id = fe1.vehicle_id
      AND fe2.odometer < fe1.odometer
      AND fe2.odometer IS NOT NULL
  ),
  fuel_consumed = (
    SELECT GREATEST(0, fe2.tank_level_after - fe1.tank_level_before)
    FROM fuel_expenses fe2
    WHERE fe2.vehicle_id = fe1.vehicle_id
      AND fe2.odometer < fe1.odometer
      AND fe2.odometer IS NOT NULL
    ORDER BY fe2.odometer DESC
    LIMIT 1
  )
WHERE fe1.odometer IS NOT NULL
  AND fe1.distance_traveled IS NULL;