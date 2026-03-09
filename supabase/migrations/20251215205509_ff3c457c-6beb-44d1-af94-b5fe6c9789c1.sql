-- Create reference table for vehicle consumption by model
CREATE TABLE public.vehicle_consumption_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  model_pattern TEXT NOT NULL,
  vehicle_category TEXT NOT NULL DEFAULT 'medio',
  expected_consumption NUMERIC NOT NULL,
  min_consumption NUMERIC,
  max_consumption NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent duplicates
ALTER TABLE public.vehicle_consumption_references 
ADD CONSTRAINT unique_brand_model_pattern UNIQUE (brand, model_pattern);

-- Enable RLS
ALTER TABLE public.vehicle_consumption_references ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (reference data)
CREATE POLICY "Authenticated users can view consumption references"
ON public.vehicle_consumption_references
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only master users can manage the reference data
CREATE POLICY "Master users can manage consumption references"
ON public.vehicle_consumption_references
FOR ALL
USING (is_master_user(auth.uid()));

-- Insert common truck consumption references (km/l)
INSERT INTO public.vehicle_consumption_references (brand, model_pattern, vehicle_category, expected_consumption, min_consumption, max_consumption) VALUES
-- Scania
('SCANIA', 'FH%', 'pesado', 2.8, 2.4, 3.2),
('SCANIA', 'R%', 'pesado', 2.6, 2.2, 3.0),
('SCANIA', 'G%', 'medio', 3.2, 2.8, 3.6),
('SCANIA', 'P%', 'medio', 3.5, 3.0, 4.0),
-- Volvo
('VOLVO', 'FH%', 'pesado', 2.8, 2.4, 3.2),
('VOLVO', 'FM%', 'pesado', 2.9, 2.5, 3.3),
('VOLVO', 'FMX%', 'pesado', 2.7, 2.3, 3.1),
('VOLVO', 'VM%', 'medio', 3.5, 3.0, 4.0),
-- Mercedes-Benz
('MERCEDES-BENZ', 'ACTROS%', 'pesado', 2.7, 2.3, 3.1),
('MERCEDES-BENZ', 'AXOR%', 'medio', 3.2, 2.8, 3.6),
('MERCEDES-BENZ', 'ATEGO%', 'leve', 4.5, 4.0, 5.0),
('MERCEDES-BENZ', 'ACCELO%', 'leve', 5.5, 5.0, 6.0),
-- MAN
('MAN', 'TGX%', 'pesado', 2.8, 2.4, 3.2),
('MAN', 'TGS%', 'medio', 3.0, 2.6, 3.4),
-- DAF
('DAF', 'XF%', 'pesado', 2.9, 2.5, 3.3),
('DAF', 'CF%', 'medio', 3.2, 2.8, 3.6),
-- Iveco
('IVECO', 'STRALIS%', 'pesado', 2.8, 2.4, 3.2),
('IVECO', 'TECTOR%', 'medio', 3.8, 3.4, 4.2),
('IVECO', 'DAILY%', 'leve', 7.0, 6.5, 7.5),
-- Volkswagen
('VOLKSWAGEN', 'CONSTELLATION%', 'medio', 3.2, 2.8, 3.6),
('VOLKSWAGEN', 'DELIVERY%', 'leve', 5.5, 5.0, 6.0),
('VW', 'CONSTELLATION%', 'medio', 3.2, 2.8, 3.6),
('VW', 'DELIVERY%', 'leve', 5.5, 5.0, 6.0),
-- Ford
('FORD', 'CARGO%', 'medio', 3.5, 3.0, 4.0),
-- Category defaults (fallbacks)
('DEFAULT', 'PESADO', 'pesado', 2.8, 2.4, 3.2),
('DEFAULT', 'MEDIO', 'medio', 3.5, 3.0, 4.0),
('DEFAULT', 'LEVE', 'leve', 5.5, 5.0, 6.0);

-- Create function to get expected consumption by brand/model
CREATE OR REPLACE FUNCTION public.get_expected_consumption(p_brand TEXT, p_model TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_consumption NUMERIC;
  v_brand_upper TEXT;
  v_model_upper TEXT;
BEGIN
  v_brand_upper := UPPER(COALESCE(p_brand, ''));
  v_model_upper := UPPER(COALESCE(p_model, ''));
  
  -- Try exact brand + model pattern match
  SELECT expected_consumption INTO v_consumption
  FROM vehicle_consumption_references
  WHERE UPPER(brand) = v_brand_upper
    AND v_model_upper LIKE REPLACE(UPPER(model_pattern), '%', '') || '%'
  LIMIT 1;
  
  IF v_consumption IS NOT NULL THEN
    RETURN v_consumption;
  END IF;
  
  -- Try to detect category from model name and use default
  IF v_model_upper LIKE '%FH%' OR v_model_upper LIKE '%ACTROS%' OR v_model_upper LIKE '%TGX%' 
     OR v_model_upper LIKE '%STRALIS%' OR v_model_upper LIKE '%XF%' THEN
    SELECT expected_consumption INTO v_consumption
    FROM vehicle_consumption_references
    WHERE brand = 'DEFAULT' AND model_pattern = 'PESADO';
  ELSIF v_model_upper LIKE '%DELIVERY%' OR v_model_upper LIKE '%DAILY%' OR v_model_upper LIKE '%ACCELO%'
     OR v_model_upper LIKE '%ATEGO%' OR v_model_upper LIKE '%3/4%' THEN
    SELECT expected_consumption INTO v_consumption
    FROM vehicle_consumption_references
    WHERE brand = 'DEFAULT' AND model_pattern = 'LEVE';
  ELSE
    -- Default to medio category
    SELECT expected_consumption INTO v_consumption
    FROM vehicle_consumption_references
    WHERE brand = 'DEFAULT' AND model_pattern = 'MEDIO';
  END IF;
  
  RETURN COALESCE(v_consumption, 3.5);
END;
$$;