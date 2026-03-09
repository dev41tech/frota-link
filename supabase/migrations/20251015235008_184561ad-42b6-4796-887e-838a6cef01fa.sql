-- Add consumption tracking fields to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS target_consumption NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS actual_consumption NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS consumption_last_updated TIMESTAMP WITH TIME ZONE;

-- Add default fleet consumption settings to companies
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS default_target_consumption NUMERIC(5,2) DEFAULT 3.5,
ADD COLUMN IF NOT EXISTS consumption_alert_threshold NUMERIC(3,0) DEFAULT 15;

-- Create vehicle consumption history table
CREATE TABLE IF NOT EXISTS vehicle_consumption_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_distance NUMERIC(10,2),
  total_liters NUMERIC(10,2),
  calculated_consumption NUMERIC(5,2),
  target_consumption NUMERIC(5,2),
  variance_percent NUMERIC(5,2),
  status TEXT CHECK (status IN ('excellent', 'good', 'warning', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS on consumption history
ALTER TABLE vehicle_consumption_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for consumption history
CREATE POLICY "Block anonymous access to vehicle_consumption_history"
ON vehicle_consumption_history
FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Users can manage consumption history in their company"
ON vehicle_consumption_history
FOR ALL
USING (user_has_company_access(auth.uid(), company_id));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_consumption_history_vehicle ON vehicle_consumption_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_consumption_history_period ON vehicle_consumption_history(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_vehicle_consumption_history_company ON vehicle_consumption_history(company_id);

-- Function to calculate vehicle consumption automatically
CREATE OR REPLACE FUNCTION calculate_vehicle_consumption(p_vehicle_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_distance NUMERIC;
  v_total_liters NUMERIC;
  v_consumption NUMERIC;
  v_last_odometer INTEGER;
  v_first_odometer INTEGER;
BEGIN
  -- Get fuel expenses from last 90 days with odometer data
  SELECT 
    MAX(odometer) - MIN(odometer) AS distance,
    SUM(liters) AS liters
  INTO v_total_distance, v_total_liters
  FROM fuel_expenses
  WHERE vehicle_id = p_vehicle_id
    AND odometer IS NOT NULL
    AND date >= NOW() - INTERVAL '90 days';
  
  -- Calculate consumption (km/l)
  IF v_total_liters > 0 AND v_total_distance > 0 THEN
    v_consumption := v_total_distance / v_total_liters;
    
    -- Update vehicle
    UPDATE vehicles
    SET 
      actual_consumption = v_consumption,
      consumption_last_updated = NOW()
    WHERE id = p_vehicle_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get consumption status
CREATE OR REPLACE FUNCTION get_consumption_status(
  p_actual NUMERIC,
  p_target NUMERIC,
  p_threshold NUMERIC DEFAULT 15
)
RETURNS TEXT AS $$
DECLARE
  v_variance_percent NUMERIC;
BEGIN
  IF p_actual IS NULL OR p_target IS NULL THEN
    RETURN 'unknown';
  END IF;
  
  -- Calculate variance percentage
  v_variance_percent := ((p_actual - p_target) / p_target) * 100;
  
  -- Determine status
  IF v_variance_percent >= p_threshold THEN
    RETURN 'excellent';
  ELSIF v_variance_percent >= 0 THEN
    RETURN 'good';
  ELSIF v_variance_percent >= -(p_threshold) THEN
    RETURN 'warning';
  ELSE
    RETURN 'critical';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function to update consumption after fuel expense
CREATE OR REPLACE FUNCTION trigger_update_vehicle_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Update consumption for the vehicle after INSERT/UPDATE of fuel expense
  PERFORM calculate_vehicle_consumption(NEW.vehicle_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS update_consumption_after_fuel_expense ON fuel_expenses;
CREATE TRIGGER update_consumption_after_fuel_expense
AFTER INSERT OR UPDATE ON fuel_expenses
FOR EACH ROW
EXECUTE FUNCTION trigger_update_vehicle_consumption();