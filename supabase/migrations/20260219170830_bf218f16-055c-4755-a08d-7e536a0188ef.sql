
-- 1. Criar tabela journey_legs
CREATE TABLE public.journey_legs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  leg_number integer NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  customer_id uuid REFERENCES public.parties(id),
  freight_value numeric,
  freight_status text DEFAULT 'pending',
  freight_due_date timestamp with time zone,
  freight_received_date timestamp with time zone,
  distance numeric,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(journey_id, leg_number)
);

-- 2. Indices
CREATE INDEX idx_journey_legs_journey_id ON public.journey_legs(journey_id);
CREATE INDEX idx_journey_legs_company_id ON public.journey_legs(company_id);

-- 3. RLS
ALTER TABLE public.journey_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anonymous access to journey_legs"
  ON public.journey_legs
  AS RESTRICTIVE
  FOR SELECT
  USING (false);

CREATE POLICY "Block anonymous insert to journey_legs"
  ON public.journey_legs
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Block anonymous update to journey_legs"
  ON public.journey_legs
  AS RESTRICTIVE
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block anonymous delete to journey_legs"
  ON public.journey_legs
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

CREATE POLICY "Users can manage journey legs in their company"
  ON public.journey_legs
  AS PERMISSIVE
  FOR ALL
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Drivers can view journey legs"
  ON public.journey_legs
  AS PERMISSIVE
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM drivers d
    JOIN journeys j ON j.driver_id = d.id
    WHERE j.id = journey_legs.journey_id
    AND d.auth_user_id = auth.uid()
  ));

CREATE POLICY "Drivers can insert journey legs"
  ON public.journey_legs
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM drivers d
    JOIN journeys j ON j.driver_id = d.id
    WHERE j.id = journey_legs.journey_id
    AND d.auth_user_id = auth.uid()
  ));

-- 4. Trigger para updated_at
CREATE TRIGGER update_journey_legs_updated_at
  BEFORE UPDATE ON public.journey_legs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Migrar dados existentes: cada jornada vira leg_number=1
INSERT INTO public.journey_legs (journey_id, leg_number, origin, destination, customer_id, freight_value, freight_status, freight_due_date, freight_received_date, distance, company_id)
SELECT 
  id, 1, origin, destination, customer_id, freight_value,
  COALESCE(freight_status, 'pending'), freight_due_date, freight_received_date, distance, company_id
FROM public.journeys
WHERE origin IS NOT NULL AND destination IS NOT NULL AND deleted_at IS NULL;
