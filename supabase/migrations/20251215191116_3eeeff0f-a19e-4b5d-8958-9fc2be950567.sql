-- Add location columns to fuel_expenses table
ALTER TABLE fuel_expenses 
ADD COLUMN IF NOT EXISTS location_lat NUMERIC,
ADD COLUMN IF NOT EXISTS location_lng NUMERIC,
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Add location columns to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS location_lat NUMERIC,
ADD COLUMN IF NOT EXISTS location_lng NUMERIC,
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN fuel_expenses.location_lat IS 'Latitude onde o abastecimento foi registrado';
COMMENT ON COLUMN fuel_expenses.location_lng IS 'Longitude onde o abastecimento foi registrado';
COMMENT ON COLUMN fuel_expenses.location_address IS 'Endereço obtido por reverse geocoding';

COMMENT ON COLUMN expenses.location_lat IS 'Latitude onde a despesa foi registrada';
COMMENT ON COLUMN expenses.location_lng IS 'Longitude onde a despesa foi registrada';
COMMENT ON COLUMN expenses.location_address IS 'Endereço obtido por reverse geocoding';