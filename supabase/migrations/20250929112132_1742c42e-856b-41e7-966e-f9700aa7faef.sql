-- CRITICAL SECURITY FIX: Block anonymous access to sensitive business data
-- This migration adds explicit policies to deny public access to all sensitive tables

-- Block anonymous access to companies table (business data, CNPJs, CPFs)
DROP POLICY IF EXISTS "Block anonymous access to companies" ON public.companies;
CREATE POLICY "Block anonymous access to companies"
ON public.companies
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to profiles table (employee personal data)
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;
CREATE POLICY "Block anonymous access to profiles" 
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to revenue table (financial records)
DROP POLICY IF EXISTS "Block anonymous access to revenue" ON public.revenue;
CREATE POLICY "Block anonymous access to revenue"
ON public.revenue
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to journeys table (operational data)
DROP POLICY IF EXISTS "Block anonymous access to journeys" ON public.journeys;
CREATE POLICY "Block anonymous access to journeys"
ON public.journeys
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to vehicles table (asset data)
DROP POLICY IF EXISTS "Block anonymous access to vehicles" ON public.vehicles;
CREATE POLICY "Block anonymous access to vehicles"
ON public.vehicles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to drivers table (personal data)
DROP POLICY IF EXISTS "Block anonymous access to drivers" ON public.drivers;
CREATE POLICY "Block anonymous access to drivers"
ON public.drivers
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to expenses table (financial data)
DROP POLICY IF EXISTS "Block anonymous access to expenses" ON public.expenses;
CREATE POLICY "Block anonymous access to expenses"
ON public.expenses
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to fuel_expenses table (operational costs)
DROP POLICY IF EXISTS "Block anonymous access to fuel_expenses" ON public.fuel_expenses;
CREATE POLICY "Block anonymous access to fuel_expenses"
ON public.fuel_expenses
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to accounts_payable table (financial obligations)
DROP POLICY IF EXISTS "Block anonymous access to accounts_payable" ON public.accounts_payable;
CREATE POLICY "Block anonymous access to accounts_payable"
ON public.accounts_payable
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to cte_documents table (tax documents)
DROP POLICY IF EXISTS "Block anonymous access to cte_documents" ON public.cte_documents;
CREATE POLICY "Block anonymous access to cte_documents"
ON public.cte_documents
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to cte_settings table (tax configuration)
DROP POLICY IF EXISTS "Block anonymous access to cte_settings" ON public.cte_settings;
CREATE POLICY "Block anonymous access to cte_settings"
ON public.cte_settings
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to digital_certificates table (security certificates)
DROP POLICY IF EXISTS "Block anonymous access to digital_certificates" ON public.digital_certificates;
CREATE POLICY "Block anonymous access to digital_certificates"
ON public.digital_certificates
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to gas_stations table (supplier data)
DROP POLICY IF EXISTS "Block anonymous access to gas_stations" ON public.gas_stations;
CREATE POLICY "Block anonymous access to gas_stations"
ON public.gas_stations
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to user_roles table (authorization data)
DROP POLICY IF EXISTS "Block anonymous access to user_roles" ON public.user_roles;
CREATE POLICY "Block anonymous access to user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to subscription_plans table (business configuration)
DROP POLICY IF EXISTS "Block anonymous access to subscription_plans" ON public.subscription_plans;
CREATE POLICY "Block anonymous access to subscription_plans"
ON public.subscription_plans
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Block anonymous access to audit_logs table (security auditing)
DROP POLICY IF EXISTS "Block anonymous access to audit_logs" ON public.audit_logs;
CREATE POLICY "Block anonymous access to audit_logs"
ON public.audit_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);