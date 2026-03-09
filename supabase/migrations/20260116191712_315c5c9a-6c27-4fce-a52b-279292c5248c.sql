-- Fix RLS policies that incorrectly block authenticated users
-- These policies were created as RESTRICTIVE for 'public' role instead of 'anon' only
-- This caused all SELECT queries to return empty results for logged-in users

-- 1. Fix expenses table
DROP POLICY IF EXISTS "Block anonymous access to expenses" ON public.expenses;
CREATE POLICY "Block anonymous access to expenses" 
  ON public.expenses 
  AS RESTRICTIVE 
  FOR ALL 
  TO anon 
  USING (false) 
  WITH CHECK (false);

-- 2. Fix bank_transactions table
DROP POLICY IF EXISTS "Block anonymous access to bank_transactions" ON public.bank_transactions;
CREATE POLICY "Block anonymous access to bank_transactions" 
  ON public.bank_transactions 
  AS RESTRICTIVE 
  FOR ALL 
  TO anon 
  USING (false) 
  WITH CHECK (false);

-- 3. Fix bank_reconciliations table
DROP POLICY IF EXISTS "Block anonymous access to bank_reconciliations" ON public.bank_reconciliations;
CREATE POLICY "Block anonymous access to bank_reconciliations" 
  ON public.bank_reconciliations 
  AS RESTRICTIVE 
  FOR ALL 
  TO anon 
  USING (false) 
  WITH CHECK (false);