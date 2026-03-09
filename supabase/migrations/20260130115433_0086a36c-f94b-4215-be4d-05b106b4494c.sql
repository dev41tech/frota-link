-- Adicionar coluna na tabela expenses para rastrear o título gerado no accounts_payable
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS accounts_payable_id uuid REFERENCES public.accounts_payable(id) ON DELETE SET NULL;

-- Adicionar coluna na tabela expenses para status de pagamento
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Adicionar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_expenses_accounts_payable_id ON public.expenses(accounts_payable_id);

-- Adicionar constraint na tabela accounts_payable para referenciar expenses (já existe expense_id, vamos usar ela)
-- A coluna expense_id já existe, apenas garantir que está sendo usada corretamente

-- Criar índice para a coluna expense_id em accounts_payable
CREATE INDEX IF NOT EXISTS idx_accounts_payable_expense_id ON public.accounts_payable(expense_id);