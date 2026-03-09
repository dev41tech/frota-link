-- Fix security warnings

-- Fix function search path for check_vehicle_limit function
CREATE OR REPLACE FUNCTION check_vehicle_limit()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_count integer;
    company_limit integer;
BEGIN
    -- Get current vehicle count for the company
    SELECT COUNT(*) INTO current_count
    FROM vehicles 
    WHERE company_id = NEW.company_id;
    
    -- Get company vehicle limit
    SELECT COALESCE(c.vehicle_limit, sp.vehicle_limit, 5) INTO company_limit
    FROM companies c 
    LEFT JOIN subscription_plans sp ON c.subscription_plan_id = sp.id
    WHERE c.id = NEW.company_id;
    
    -- Check if adding this vehicle would exceed the limit
    IF current_count >= company_limit THEN
        RAISE EXCEPTION 'Vehicle limit exceeded. Current plan allows up to % vehicles.', company_limit;
    END IF;
    
    RETURN NEW;
END;
$$;