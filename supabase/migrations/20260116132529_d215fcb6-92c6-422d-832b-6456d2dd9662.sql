-- Add Asaas integration fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS billing_cpf_cnpj TEXT;

-- Add Asaas integration fields to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'boleto',
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_asaas_customer_id ON public.companies(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_payment_id ON public.invoices(asaas_payment_id);