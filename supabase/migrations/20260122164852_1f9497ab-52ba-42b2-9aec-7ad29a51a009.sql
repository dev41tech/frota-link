-- Fix: Make the anonymous block policy RESTRICTIVE for drivers table
DROP POLICY IF EXISTS "Block anonymous access to drivers" ON public.drivers;

-- Recreate as RESTRICTIVE policy to block anonymous access
CREATE POLICY "Block anonymous access to drivers"
ON public.drivers
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Add RESTRICTIVE policy for authenticated users to ensure they must be authenticated
CREATE POLICY "Require authentication for drivers"
ON public.drivers
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);