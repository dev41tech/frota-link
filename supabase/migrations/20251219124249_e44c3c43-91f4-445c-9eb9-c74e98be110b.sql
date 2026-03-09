-- Create bank_transactions table for imported bank statement transactions
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  import_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  bank_reference TEXT,
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('csv', 'ofx')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'ignored')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bank_reconciliations table for linking transactions to revenues/expenses
CREATE TABLE public.bank_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  revenue_id UUID REFERENCES public.revenue(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  accounts_payable_id UUID REFERENCES public.accounts_payable(id) ON DELETE SET NULL,
  fuel_expense_id UUID REFERENCES public.fuel_expenses(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('auto', 'manual')),
  match_confidence NUMERIC,
  reconciled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reconciled_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add reconciled_at field to revenue table
ALTER TABLE public.revenue ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.revenue ADD COLUMN IF NOT EXISTS bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL;

-- Add reconciled_at field to expenses table
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL;

-- Add reconciled_at field to accounts_payable table
ALTER TABLE public.accounts_payable ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.accounts_payable ADD COLUMN IF NOT EXISTS bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL;

-- Add reconciled_at field to fuel_expenses table
ALTER TABLE public.fuel_expenses ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.fuel_expenses ADD COLUMN IF NOT EXISTS bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_bank_transactions_company_id ON public.bank_transactions(company_id);
CREATE INDEX idx_bank_transactions_status ON public.bank_transactions(status);
CREATE INDEX idx_bank_transactions_import_batch ON public.bank_transactions(import_batch_id);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(transaction_date);
CREATE INDEX idx_bank_reconciliations_company_id ON public.bank_reconciliations(company_id);
CREATE INDEX idx_bank_reconciliations_transaction ON public.bank_reconciliations(bank_transaction_id);
CREATE INDEX idx_revenue_reconciled ON public.revenue(reconciled_at) WHERE reconciled_at IS NOT NULL;
CREATE INDEX idx_expenses_reconciled ON public.expenses(reconciled_at) WHERE reconciled_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_transactions
CREATE POLICY "Block anonymous access to bank_transactions"
  ON public.bank_transactions
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Users can manage bank transactions in their company"
  ON public.bank_transactions
  FOR ALL
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- RLS Policies for bank_reconciliations
CREATE POLICY "Block anonymous access to bank_reconciliations"
  ON public.bank_reconciliations
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Users can manage bank reconciliations in their company"
  ON public.bank_reconciliations
  FOR ALL
  USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Create trigger for updated_at on bank_transactions
CREATE TRIGGER update_bank_transactions_updated_at
  BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();