-- Add policy for authenticated users to read subscription plans
CREATE POLICY "Authenticated users can view subscription plans"
ON public.subscription_plans
FOR SELECT
USING (auth.uid() IS NOT NULL);