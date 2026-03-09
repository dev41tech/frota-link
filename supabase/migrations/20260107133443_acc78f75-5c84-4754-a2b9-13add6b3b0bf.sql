-- 1. Remover políticas antigas (RESTRICTIVE) da vehicle_maintenances
DROP POLICY IF EXISTS "Block anonymous access to vehicle_maintenances" ON vehicle_maintenances;
DROP POLICY IF EXISTS "Users can manage maintenances in their company" ON vehicle_maintenances;

-- 2. Recriar como PERMISSIVE (padrão correto)
CREATE POLICY "Users can manage maintenances in their company"
ON vehicle_maintenances
AS PERMISSIVE
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- 3. Corrigir accounts_payable (adicionar WITH CHECK)
DROP POLICY IF EXISTS "Users can manage accounts payable in their company" ON accounts_payable;

CREATE POLICY "Users can manage accounts payable in their company"
ON accounts_payable
AS PERMISSIVE
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));