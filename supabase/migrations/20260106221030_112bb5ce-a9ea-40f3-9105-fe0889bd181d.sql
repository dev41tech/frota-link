-- Drop funções existentes para recriar com novos nomes de parâmetros
DROP FUNCTION IF EXISTS public.is_bpo_with_company_access(uuid, uuid);

-- Criar função auxiliar para verificar se usuário é BPO com acesso à empresa
CREATE OR REPLACE FUNCTION public.is_bpo_with_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.bpo_company_access bca ON bca.bpo_user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'bpo'
      AND bca.company_id = _company_id
      AND bca.revoked_at IS NULL
  )
$$;

-- Atualizar a função user_has_company_access para incluir BPO e Suporte
CREATE OR REPLACE FUNCTION public.user_has_company_access(user_uuid uuid, company_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_uuid
      AND (
        -- Master tem acesso a tudo
        role = 'master'
        -- Usuário pertence à empresa
        OR company_id = company_uuid
      )
  )
  -- OU é BPO com acesso liberado à empresa
  OR public.is_bpo_with_company_access(user_uuid, company_uuid)
  -- OU é Suporte (acesso a todas as empresas)
  OR public.is_support_user(user_uuid)
$$;