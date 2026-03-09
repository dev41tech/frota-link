-- Tabela para histórico de performance dos motoristas
CREATE TABLE IF NOT EXISTS public.driver_performance_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Métricas de performance
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_journeys INTEGER NOT NULL DEFAULT 0,
  total_distance NUMERIC(10,2) DEFAULT 0,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  total_fuel_cost NUMERIC(10,2) DEFAULT 0,
  total_expenses NUMERIC(10,2) DEFAULT 0,
  
  -- Indicadores calculados
  fuel_efficiency NUMERIC(6,2) DEFAULT 0, -- km/l
  revenue_per_km NUMERIC(8,2) DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0, -- %
  performance_score NUMERIC(5,2) DEFAULT 0, -- 0-100
  rank_position INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.driver_performance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anonymous access to driver_performance_history"
ON public.driver_performance_history
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Users can manage performance history in their company"
ON public.driver_performance_history
AS PERMISSIVE
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id));

-- Índices para melhor performance
CREATE INDEX idx_driver_performance_history_driver_id ON public.driver_performance_history(driver_id);
CREATE INDEX idx_driver_performance_history_company_id ON public.driver_performance_history(company_id);
CREATE INDEX idx_driver_performance_history_period ON public.driver_performance_history(period_start, period_end);

-- Trigger para updated_at
CREATE TRIGGER update_driver_performance_history_updated_at
BEFORE UPDATE ON public.driver_performance_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();