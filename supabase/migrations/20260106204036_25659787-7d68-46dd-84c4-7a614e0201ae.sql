-- Backup duplicates for audit before deletion
CREATE TABLE IF NOT EXISTS public.audit_user_roles_cleanup (
  id uuid,
  user_id uuid,
  company_id uuid,
  role app_role,
  created_at timestamptz,
  cleaned_at timestamptz DEFAULT now()
);

-- Insert duplicates into audit table
INSERT INTO public.audit_user_roles_cleanup (id, user_id, company_id, role, created_at)
SELECT id, user_id, company_id, role, created_at
FROM user_roles
WHERE user_id IN (
  SELECT user_id FROM user_roles 
  GROUP BY user_id HAVING COUNT(*) > 1
);

-- Keep only the most recent role record per user
WITH duplicates AS (
  SELECT id, user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM user_roles
)
DELETE FROM user_roles 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);