-- Fix RLS policies for expense_categories
DROP POLICY IF EXISTS "Block anonymous access to expense_categories" ON expense_categories;
DROP POLICY IF EXISTS "Users can manage expense categories in their company" ON expense_categories;

-- RESTRICTIVE policy: Block anonymous, allow authenticated
CREATE POLICY "Block anonymous access to expense_categories"
ON expense_categories
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- PERMISSIVE policy: Validate company access (NOW WITH WITH CHECK!)
CREATE POLICY "Users can manage expense categories in their company"
ON expense_categories
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Fix RLS policies for revenue_categories
DROP POLICY IF EXISTS "Block anonymous access to revenue_categories" ON revenue_categories;
DROP POLICY IF EXISTS "Users can manage revenue categories in their company" ON revenue_categories;

-- RESTRICTIVE policy: Block anonymous, allow authenticated
CREATE POLICY "Block anonymous access to revenue_categories"
ON revenue_categories
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- PERMISSIVE policy: Validate company access (NOW WITH WITH CHECK!)
CREATE POLICY "Users can manage revenue categories in their company"
ON revenue_categories
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));