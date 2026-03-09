-- Tabela para controlar numeração de séries CT-e
CREATE TABLE public.cte_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  series TEXT NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, series)
);

-- Enable RLS
ALTER TABLE public.cte_series ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Block anonymous access to cte_series"
ON public.cte_series
FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Users can manage cte_series in their company"
ON public.cte_series
FOR ALL
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Trigger para updated_at
CREATE TRIGGER update_cte_series_updated_at
BEFORE UPDATE ON public.cte_series
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para performance
CREATE INDEX idx_cte_series_company_active ON public.cte_series(company_id, is_active);

-- Comentário na tabela
COMMENT ON TABLE public.cte_series IS 'Controle de numeração de séries para emissão de CT-e';