
-- Create freight_pricing_settings table
CREATE TABLE public.freight_pricing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  avg_consumption_kml NUMERIC NULL,
  avg_diesel_price NUMERIC NULL,
  driver_commission NUMERIC NOT NULL DEFAULT 12,
  profit_margin NUMERIC NOT NULL DEFAULT 30,
  default_axles INTEGER NOT NULL DEFAULT 7,
  toll_cost_per_axle_km NUMERIC NOT NULL DEFAULT 0.11,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.freight_pricing_settings ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block anon freight_pricing_settings"
ON public.freight_pricing_settings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Authenticated users with company access
CREATE POLICY "Users can manage freight_pricing_settings"
ON public.freight_pricing_settings
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Service role needs access for edge functions
CREATE POLICY "Service role full access freight_pricing_settings"
ON public.freight_pricing_settings
FOR SELECT
TO service_role
USING (true);
