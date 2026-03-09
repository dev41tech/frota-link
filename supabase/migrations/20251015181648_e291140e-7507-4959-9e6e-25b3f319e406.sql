-- Fix company_id NULL constraint for master users
-- Remove NOT NULL first, then update data, then add check constraint

-- 1. Remove NOT NULL constraint from company_id
ALTER TABLE public.profiles 
  ALTER COLUMN company_id DROP NOT NULL;

-- 2. Set company_id to NULL for all master users
UPDATE public.profiles 
SET company_id = NULL 
WHERE role = 'master';

-- 3. Add check constraint to ensure only master users can have NULL company_id
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_id_null_check 
  CHECK (
    (role = 'master' AND company_id IS NULL) OR 
    (role != 'master' AND company_id IS NOT NULL)
  );