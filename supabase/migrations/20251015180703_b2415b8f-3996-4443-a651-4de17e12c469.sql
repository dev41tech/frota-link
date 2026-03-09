-- 1) Remover duplicatas em profiles por user_id (mantém a mais recente)
WITH dups AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
  FROM public.profiles
)
DELETE FROM public.profiles p
USING dups
WHERE p.id = dups.id
  AND dups.rn > 1;

-- 2) Garantir unicidade de profiles.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 3) Criar FK de user_roles.user_id -> profiles.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
      ON DELETE CASCADE;
  END IF;
END $$;