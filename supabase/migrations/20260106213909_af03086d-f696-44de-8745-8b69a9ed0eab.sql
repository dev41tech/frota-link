-- Remover constraint antigo
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_company_id_null_check;

-- Criar novo constraint que inclui bpo e suporte como staff interno
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_company_id_null_check 
CHECK (
  ((role IN ('master', 'bpo', 'suporte')) AND (company_id IS NULL)) 
  OR 
  ((role NOT IN ('master', 'bpo', 'suporte')) AND (company_id IS NOT NULL))
);