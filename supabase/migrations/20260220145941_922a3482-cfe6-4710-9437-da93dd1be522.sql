
-- 1. Add portal_enabled to parties
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT false;

-- 2. Create freight_rates table
CREATE TABLE public.freight_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  origin_state text,
  destination_state text,
  origin_city text,
  destination_city text,
  min_weight_kg numeric NOT NULL DEFAULT 0,
  max_weight_kg numeric NOT NULL DEFAULT 999999,
  rate_per_kg numeric NOT NULL DEFAULT 0,
  minimum_freight numeric NOT NULL DEFAULT 0,
  cubage_factor numeric DEFAULT 300,
  volume_rate numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.freight_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon freight_rates select" ON public.freight_rates FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon freight_rates insert" ON public.freight_rates FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon freight_rates update" ON public.freight_rates FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon freight_rates delete" ON public.freight_rates FOR DELETE TO anon USING (false);

CREATE POLICY "Users can select freight rates" ON public.freight_rates FOR SELECT USING (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert freight rates" ON public.freight_rates FOR INSERT WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update freight rates" ON public.freight_rates FOR UPDATE USING (user_has_company_access(auth.uid(), company_id)) WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete freight rates" ON public.freight_rates FOR DELETE USING (user_has_company_access(auth.uid(), company_id));

-- 3. Create customer_portal_tokens table
CREATE TABLE public.customer_portal_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  last_accessed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon portal_tokens select" ON public.customer_portal_tokens FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon portal_tokens insert" ON public.customer_portal_tokens FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon portal_tokens update" ON public.customer_portal_tokens FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon portal_tokens delete" ON public.customer_portal_tokens FOR DELETE TO anon USING (false);

CREATE POLICY "Users can select portal tokens" ON public.customer_portal_tokens FOR SELECT USING (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert portal tokens" ON public.customer_portal_tokens FOR INSERT WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update portal tokens" ON public.customer_portal_tokens FOR UPDATE USING (user_has_company_access(auth.uid(), company_id)) WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete portal tokens" ON public.customer_portal_tokens FOR DELETE USING (user_has_company_access(auth.uid(), company_id));

-- 4. Create freight_requests table
CREATE TABLE public.freight_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.parties(id),
  token_id uuid NOT NULL REFERENCES public.customer_portal_tokens(id),
  status text NOT NULL DEFAULT 'pending',
  request_number text,
  nfe_xml_data jsonb,
  nfe_access_key text,
  nfe_number text,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  cargo_weight_kg numeric,
  cargo_value numeric,
  cargo_description text,
  vehicle_type_requested text,
  freight_value numeric,
  freight_rate_id uuid REFERENCES public.freight_rates(id),
  customer_notes text,
  operator_notes text,
  approved_at timestamp with time zone,
  journey_id uuid REFERENCES public.journeys(id),
  cte_document_id uuid REFERENCES public.cte_documents(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  driver_id uuid REFERENCES public.drivers(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.freight_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon freight_requests select" ON public.freight_requests FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon freight_requests insert" ON public.freight_requests FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon freight_requests update" ON public.freight_requests FOR UPDATE TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon freight_requests delete" ON public.freight_requests FOR DELETE TO anon USING (false);

CREATE POLICY "Users can select freight requests" ON public.freight_requests FOR SELECT USING (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can insert freight requests" ON public.freight_requests FOR INSERT WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can update freight requests" ON public.freight_requests FOR UPDATE USING (user_has_company_access(auth.uid(), company_id)) WITH CHECK (user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Users can delete freight requests" ON public.freight_requests FOR DELETE USING (user_has_company_access(auth.uid(), company_id));

-- 5. Auto-generate request_number via sequence
CREATE SEQUENCE IF NOT EXISTS freight_request_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_freight_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'FR-' || LPAD(nextval('freight_request_number_seq')::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_freight_request_number
  BEFORE INSERT ON public.freight_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL)
  EXECUTE FUNCTION public.generate_freight_request_number();

-- 6. Updated_at triggers
CREATE TRIGGER update_freight_rates_updated_at
  BEFORE UPDATE ON public.freight_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_freight_requests_updated_at
  BEFORE UPDATE ON public.freight_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
