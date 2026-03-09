-- Policy para BPO: ver apenas empresas vinculadas ativas
CREATE POLICY "BPO users can view linked companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bpo_company_access a
    WHERE a.bpo_user_id = auth.uid()
      AND a.company_id = companies.id
      AND a.revoked_at IS NULL
  )
);

-- Policy para Suporte: ver todas as empresas
CREATE POLICY "Support users can view all companies"
ON public.companies
FOR SELECT
TO authenticated
USING (public.is_support_user(auth.uid()));