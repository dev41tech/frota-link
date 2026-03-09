-- Criar tabela parties para clientes e fornecedores
CREATE TABLE public.parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer', 'supplier')),
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_district TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  ie TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_parties_company_id ON public.parties(company_id);
CREATE INDEX idx_parties_type ON public.parties(type);
CREATE INDEX idx_parties_document ON public.parties(document);
CREATE INDEX idx_parties_name ON public.parties(name);

-- Enable RLS
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Block anonymous access to parties"
ON public.parties
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Users can manage parties in their company"
ON public.parties
FOR ALL
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Trigger para updated_at
CREATE TRIGGER update_parties_updated_at
BEFORE UPDATE ON public.parties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar FK customer_id na tabela journeys
ALTER TABLE public.journeys ADD COLUMN customer_id UUID REFERENCES public.parties(id) ON DELETE SET NULL;
CREATE INDEX idx_journeys_customer_id ON public.journeys(customer_id);

-- Adicionar FK customer_id na tabela revenue
ALTER TABLE public.revenue ADD COLUMN customer_id UUID REFERENCES public.parties(id) ON DELETE SET NULL;
CREATE INDEX idx_revenue_customer_id ON public.revenue(customer_id);

-- Adicionar FK supplier_id na tabela expenses
ALTER TABLE public.expenses ADD COLUMN supplier_id UUID REFERENCES public.parties(id) ON DELETE SET NULL;
CREATE INDEX idx_expenses_supplier_id ON public.expenses(supplier_id);

-- Adicionar FK supplier_id na tabela accounts_payable
ALTER TABLE public.accounts_payable ADD COLUMN supplier_id UUID REFERENCES public.parties(id) ON DELETE SET NULL;
CREATE INDEX idx_accounts_payable_supplier_id ON public.accounts_payable(supplier_id);