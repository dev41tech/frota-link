-- Corrigir função update_updated_at_column para incluir search_path
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recriar os triggers
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