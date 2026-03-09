-- Create vehicle_maintenances table
CREATE TABLE public.vehicle_maintenances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Tipo e categoria
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('preventive', 'corrective')),
  service_category TEXT NOT NULL,
  
  -- Detalhes do serviço
  description TEXT NOT NULL,
  provider_name TEXT,
  provider_cnpj TEXT,
  
  -- Valores
  labor_cost NUMERIC DEFAULT 0,
  parts_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  
  -- Datas e KM
  service_date DATE NOT NULL,
  odometer_at_service INTEGER,
  
  -- Próxima manutenção (para preventivas)
  next_due_date DATE,
  next_due_km INTEGER,
  
  -- Status e controle
  status TEXT DEFAULT 'completed' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  receipt_url TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_maintenances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Block anonymous access to vehicle_maintenances"
ON public.vehicle_maintenances
AS RESTRICTIVE
FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Users can manage maintenances in their company"
ON public.vehicle_maintenances
AS RESTRICTIVE
FOR ALL
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Create trigger for updated_at
CREATE TRIGGER update_vehicle_maintenances_updated_at
BEFORE UPDATE ON public.vehicle_maintenances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_vehicle_maintenances_company_id ON public.vehicle_maintenances(company_id);
CREATE INDEX idx_vehicle_maintenances_vehicle_id ON public.vehicle_maintenances(vehicle_id);
CREATE INDEX idx_vehicle_maintenances_service_date ON public.vehicle_maintenances(service_date);
CREATE INDEX idx_vehicle_maintenances_next_due ON public.vehicle_maintenances(next_due_date, next_due_km);