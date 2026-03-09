-- Recalcular distance_traveled e fuel_consumed baseado em abastecimentos consecutivos do mesmo veículo
-- Para cada registro, usa a diferença de hodômetro entre o abastecimento atual e o anterior

WITH consecutive_fuels AS (
  SELECT 
    id,
    vehicle_id,
    odometer,
    liters,
    date,
    LAG(odometer) OVER (PARTITION BY vehicle_id ORDER BY date, created_at) as prev_odometer
  FROM fuel_expenses
  WHERE odometer IS NOT NULL
)
UPDATE fuel_expenses f
SET 
  distance_traveled = cf.odometer - cf.prev_odometer,
  fuel_consumed = CASE 
    WHEN cf.odometer - cf.prev_odometer > 0 AND f.liters > 0
    THEN ROUND(((cf.odometer - cf.prev_odometer)::numeric / f.liters::numeric), 2)
    ELSE NULL 
  END
FROM consecutive_fuels cf
WHERE f.id = cf.id
  AND cf.prev_odometer IS NOT NULL
  AND cf.odometer > cf.prev_odometer
  AND cf.odometer - cf.prev_odometer < 5000; -- Limite de 5000km para evitar cálculos absurdos