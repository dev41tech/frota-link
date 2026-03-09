-- Fix: Make the anonymous block policy RESTRICTIVE
-- First, drop the current permissive policy
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Recreate as RESTRICTIVE policy to block anonymous access
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Also add a RESTRICTIVE policy for authenticated users to ensure they must be authenticated
-- This is a defense-in-depth measure
CREATE POLICY "Require authentication for profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);