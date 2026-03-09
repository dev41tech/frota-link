-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert fiscal audit logs" ON public.fiscal_audit_logs;

-- Create a more restrictive INSERT policy
CREATE POLICY "Authenticated users can insert own fiscal audit logs"
ON public.fiscal_audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);