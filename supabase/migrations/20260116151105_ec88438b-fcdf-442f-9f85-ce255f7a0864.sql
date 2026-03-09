-- Fix overly permissive RLS policies

-- 1. Fix audit_logs: Restrict INSERT to authenticated users only (audit logs are inserted by the system/triggers)
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
ON audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Fix expense_categories: The "Block anonymous access" policy has wrong logic (using true blocks nothing)
-- It should use USING (false) to block, not USING (true)
DROP POLICY IF EXISTS "Block anonymous access to expense_categories" ON expense_categories;
CREATE POLICY "Block anonymous access to expense_categories"
ON expense_categories
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 3. Fix revenue_categories: Same issue as expense_categories
DROP POLICY IF EXISTS "Block anonymous access to revenue_categories" ON revenue_categories;
CREATE POLICY "Block anonymous access to revenue_categories"
ON revenue_categories
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 4. Fix usage_logs: Restrict INSERT to authenticated users only
DROP POLICY IF EXISTS "System can insert usage logs" ON usage_logs;
CREATE POLICY "Authenticated users can insert usage logs"
ON usage_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);