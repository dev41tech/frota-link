-- Add contracted_price_per_vehicle column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contracted_price_per_vehicle numeric;

COMMENT ON COLUMN public.companies.contracted_price_per_vehicle IS 'Custom negotiated price per vehicle for this company';