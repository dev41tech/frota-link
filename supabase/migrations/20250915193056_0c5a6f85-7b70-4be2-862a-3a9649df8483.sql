-- Create CT-e documents table
CREATE TABLE public.cte_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  journey_id UUID REFERENCES public.journeys(id) ON DELETE SET NULL,
  cte_number TEXT,
  cte_key TEXT,
  series TEXT NOT NULL DEFAULT '1',
  xml_content TEXT,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  environment TEXT NOT NULL DEFAULT 'homologacao',
  nuvem_fiscal_id TEXT,
  emission_date TIMESTAMP WITH TIME ZONE,
  authorization_date TIMESTAMP WITH TIME ZONE,
  cancellation_date TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  freight_value NUMERIC,
  icms_value NUMERIC,
  recipient_name TEXT NOT NULL,
  recipient_document TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_document TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create CT-e settings table
CREATE TABLE public.cte_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  nuvem_fiscal_company_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'homologacao',
  default_series TEXT NOT NULL DEFAULT '1',
  auto_emit_enabled BOOLEAN NOT NULL DEFAULT false,
  certificate_name TEXT,
  certificate_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create digital certificates table
CREATE TABLE public.digital_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  certificate_name TEXT NOT NULL,
  nuvem_fiscal_certificate_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cte_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cte_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_certificates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cte_documents
CREATE POLICY "Users can manage CT-e documents in their company" 
ON public.cte_documents 
FOR ALL 
USING ((company_id = get_user_company_id(auth.uid())) OR is_master_user(auth.uid()));

-- Create RLS policies for cte_settings
CREATE POLICY "Users can manage CT-e settings in their company" 
ON public.cte_settings 
FOR ALL 
USING ((company_id = get_user_company_id(auth.uid())) OR is_master_user(auth.uid()));

-- Create RLS policies for digital_certificates
CREATE POLICY "Users can manage digital certificates in their company" 
ON public.digital_certificates 
FOR ALL 
USING ((company_id = get_user_company_id(auth.uid())) OR is_master_user(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_cte_documents_updated_at
BEFORE UPDATE ON public.cte_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cte_settings_updated_at
BEFORE UPDATE ON public.cte_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_digital_certificates_updated_at
BEFORE UPDATE ON public.digital_certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add company_id trigger
CREATE TRIGGER set_cte_documents_company_id
BEFORE INSERT ON public.cte_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id();

CREATE TRIGGER set_cte_settings_company_id
BEFORE INSERT ON public.cte_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id();

CREATE TRIGGER set_digital_certificates_company_id
BEFORE INSERT ON public.digital_certificates
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id();