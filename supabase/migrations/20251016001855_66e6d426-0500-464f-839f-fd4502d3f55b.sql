-- Criar tabela para MDF-e (Manifesto de Documentos Fiscais Eletrônico)
CREATE TABLE IF NOT EXISTS public.mdfe_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  mdfe_number TEXT,
  mdfe_key TEXT,
  serie TEXT NOT NULL DEFAULT '1',
  emission_date TIMESTAMP WITH TIME ZONE,
  uf_start TEXT NOT NULL,
  uf_end TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  driver_cpf TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_weight NUMERIC,
  total_value NUMERIC,
  closure_date TIMESTAMP WITH TIME ZONE,
  nuvem_fiscal_id TEXT,
  xml_content TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.mdfe_documents ENABLE ROW LEVEL SECURITY;

-- Política de acesso para MDF-e
CREATE POLICY "Users can manage MDF-e in their company" 
ON public.mdfe_documents 
FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Block anonymous access to mdfe_documents" 
ON public.mdfe_documents 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Criar tabela para vincular CT-es ao MDF-e
CREATE TABLE IF NOT EXISTS public.mdfe_cte_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mdfe_id UUID NOT NULL REFERENCES public.mdfe_documents(id) ON DELETE CASCADE,
  cte_id UUID REFERENCES public.cte_documents(id) ON DELETE SET NULL,
  cte_key TEXT NOT NULL,
  weight NUMERIC,
  value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.mdfe_cte_links ENABLE ROW LEVEL SECURITY;

-- Política de acesso para links
CREATE POLICY "Users can manage MDF-e links" 
ON public.mdfe_cte_links 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.mdfe_documents 
    WHERE mdfe_documents.id = mdfe_cte_links.mdfe_id 
    AND user_has_company_access(auth.uid(), mdfe_documents.company_id)
  )
);

CREATE POLICY "Block anonymous access to mdfe_cte_links" 
ON public.mdfe_cte_links 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Criar tabela para CT-e de Anulação
CREATE TABLE IF NOT EXISTS public.cte_anulacao_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  original_cte_id UUID REFERENCES public.cte_documents(id) ON DELETE SET NULL,
  substitute_cte_key TEXT,
  cte_number TEXT,
  cte_key TEXT,
  serie TEXT NOT NULL DEFAULT '2',
  emission_date TIMESTAMP WITH TIME ZONE,
  authorization_date TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_document TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_document TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  freight_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  nuvem_fiscal_id TEXT,
  xml_content TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cte_anulacao_documents ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para CT-e Anulação
CREATE POLICY "Users can manage CT-e anulacao in their company" 
ON public.cte_anulacao_documents 
FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Block anonymous access to cte_anulacao_documents" 
ON public.cte_anulacao_documents 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Criar tabela para templates de remetentes/destinatários
CREATE TABLE IF NOT EXISTS public.fiscal_party_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sender', 'recipient', 'carrier')),
  name TEXT NOT NULL,
  document TEXT NOT NULL,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_district TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  phone TEXT,
  email TEXT,
  ie TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.fiscal_party_templates ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para templates
CREATE POLICY "Users can manage party templates in their company" 
ON public.fiscal_party_templates 
FOR ALL 
USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Block anonymous access to fiscal_party_templates" 
ON public.fiscal_party_templates 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mdfe_documents_updated_at
BEFORE UPDATE ON public.mdfe_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cte_anulacao_documents_updated_at
BEFORE UPDATE ON public.cte_anulacao_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fiscal_party_templates_updated_at
BEFORE UPDATE ON public.fiscal_party_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();