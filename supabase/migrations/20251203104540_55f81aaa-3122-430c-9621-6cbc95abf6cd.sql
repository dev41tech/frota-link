-- Add odometer_final column to fuel_expenses table for consumption calculation
ALTER TABLE public.fuel_expenses 
ADD COLUMN IF NOT EXISTS odometer_final integer;

-- Add comment explaining the field
COMMENT ON COLUMN public.fuel_expenses.odometer_final IS 'Final odometer reading for calculating average fuel consumption';

-- Create or replace function to auto-calculate distance_traveled when odometer_final is set
CREATE OR REPLACE FUNCTION public.calculate_fuel_distance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate distance traveled if both odometer readings are available
  IF NEW.odometer IS NOT NULL AND NEW.odometer_final IS NOT NULL THEN
    NEW.distance_traveled := NEW.odometer_final - NEW.odometer;
    
    -- Calculate consumption (km/l) if liters is available
    IF NEW.liters > 0 AND NEW.distance_traveled > 0 THEN
      NEW.fuel_consumed := ROUND((NEW.distance_traveled::numeric / NEW.liters::numeric), 2);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic calculation
DROP TRIGGER IF EXISTS trigger_calculate_fuel_distance ON public.fuel_expenses;
CREATE TRIGGER trigger_calculate_fuel_distance
BEFORE INSERT OR UPDATE ON public.fuel_expenses
FOR EACH ROW
EXECUTE FUNCTION public.calculate_fuel_distance();