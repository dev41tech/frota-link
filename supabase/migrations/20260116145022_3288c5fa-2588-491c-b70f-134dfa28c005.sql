-- Drop the incorrect permissive policy and create as restrictive
DROP POLICY IF EXISTS "Block anonymous access to expenses" ON public.expenses;

CREATE POLICY "Block anonymous access to expenses"
ON public.expenses
AS RESTRICTIVE
FOR ALL
USING (false)
WITH CHECK (false);