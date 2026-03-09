-- =====================================================
-- MELHORIAS DO MÓDULO DE MANUTENÇÕES
-- =====================================================

-- 1. Tabela de Oficinas (Workshops)
CREATE TABLE public.workshops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  specialties TEXT[] DEFAULT '{}',
  rating DECIMAL(2,1) CHECK (rating >= 1.0 AND rating <= 5.0),
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para workshops
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workshops from their company"
  ON public.workshops FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert workshops in their company"
  ON public.workshops FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update workshops in their company"
  ON public.workshops FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete workshops in their company"
  ON public.workshops FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Índices para workshops
CREATE INDEX idx_workshops_company_id ON public.workshops(company_id);
CREATE INDEX idx_workshops_status ON public.workshops(status);

-- 2. Alterar tabela vehicle_maintenances para incluir campos de NF e oficina
ALTER TABLE public.vehicle_maintenances 
  ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES public.workshops(id),
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_key TEXT,
  ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_xml_url TEXT;

-- Índice para workshop_id
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenances_workshop_id ON public.vehicle_maintenances(workshop_id);

-- 3. Tabela de Peças Detalhadas
CREATE TABLE public.maintenance_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance_id UUID NOT NULL REFERENCES public.vehicle_maintenances(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  part_code TEXT,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'UN',
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  ncm TEXT,
  cfop TEXT,
  origin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para maintenance_parts
ALTER TABLE public.maintenance_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view parts from their company"
  ON public.maintenance_parts FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert parts in their company"
  ON public.maintenance_parts FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update parts in their company"
  ON public.maintenance_parts FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete parts in their company"
  ON public.maintenance_parts FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Índices para maintenance_parts
CREATE INDEX idx_maintenance_parts_maintenance_id ON public.maintenance_parts(maintenance_id);
CREATE INDEX idx_maintenance_parts_company_id ON public.maintenance_parts(company_id);

-- 4. Tabela de Configuração de Intervalos de Manutenção
CREATE TABLE public.maintenance_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_category TEXT NOT NULL,
  service_name TEXT NOT NULL,
  interval_months INT,
  interval_km INT,
  alert_days_before INT DEFAULT 7,
  alert_km_before INT DEFAULT 500,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_schedule_per_vehicle UNIQUE NULLS NOT DISTINCT (company_id, vehicle_id, service_category)
);

-- RLS para maintenance_schedules
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedules from their company"
  ON public.maintenance_schedules FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert schedules in their company"
  ON public.maintenance_schedules FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update schedules in their company"
  ON public.maintenance_schedules FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete schedules in their company"
  ON public.maintenance_schedules FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Índices para maintenance_schedules
CREATE INDEX idx_maintenance_schedules_company_id ON public.maintenance_schedules(company_id);
CREATE INDEX idx_maintenance_schedules_vehicle_id ON public.maintenance_schedules(vehicle_id);
CREATE INDEX idx_maintenance_schedules_category ON public.maintenance_schedules(service_category);

-- Trigger para updated_at em workshops
CREATE TRIGGER update_workshops_updated_at
  BEFORE UPDATE ON public.workshops
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em maintenance_parts
CREATE TRIGGER update_maintenance_parts_updated_at
  BEFORE UPDATE ON public.maintenance_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em maintenance_schedules
CREATE TRIGGER update_maintenance_schedules_updated_at
  BEFORE UPDATE ON public.maintenance_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();