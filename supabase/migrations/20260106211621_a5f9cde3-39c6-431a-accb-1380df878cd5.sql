-- Migração 2: Criar tabela de vínculo BPO-Empresa e funções de segurança

-- Criar tabela de vínculo BPO-Empresa
CREATE TABLE IF NOT EXISTS public.bpo_company_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bpo_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bpo_user_id, company_id)
);

-- Habilitar RLS
ALTER TABLE public.bpo_company_access ENABLE ROW LEVEL SECURITY;

-- Política: Apenas masters podem gerenciar vínculos
CREATE POLICY "Masters can manage BPO access" ON public.bpo_company_access
  FOR ALL TO authenticated
  USING (public.is_master_user(auth.uid()))
  WITH CHECK (public.is_master_user(auth.uid()));

-- Política: BPOs podem ver seus próprios vínculos
CREATE POLICY "BPOs can view own access" ON public.bpo_company_access
  FOR SELECT TO authenticated
  USING (bpo_user_id = auth.uid());

-- Função para verificar se usuário é BPO
CREATE OR REPLACE FUNCTION public.is_bpo_user(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND role = 'bpo'
  )
$$;

-- Função para verificar se usuário é Suporte
CREATE OR REPLACE FUNCTION public.is_support_user(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND role = 'suporte'
  )
$$;

-- Função para verificar se usuário é staff interno (master, bpo ou suporte)
CREATE OR REPLACE FUNCTION public.is_internal_staff(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND role IN ('master', 'bpo', 'suporte')
  )
$$;

-- Função para verificar acesso BPO a uma empresa específica
CREATE OR REPLACE FUNCTION public.bpo_has_company_access(user_uuid UUID, company_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bpo_company_access
    WHERE bpo_user_id = user_uuid
    AND company_id = company_uuid
    AND revoked_at IS NULL
  )
$$;

-- Função combinada para verificar se usuário (incluindo staff) tem acesso à empresa
CREATE OR REPLACE FUNCTION public.staff_has_company_access(user_uuid UUID, company_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Usuário normal da empresa
    public.user_has_company_access(user_uuid, company_uuid)
    -- Ou é BPO com acesso à empresa
    OR public.bpo_has_company_access(user_uuid, company_uuid)
    -- Ou é suporte (acesso global)
    OR public.is_support_user(user_uuid)
    -- Ou é master (acesso global)
    OR public.is_master_user(user_uuid)
$$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_bpo_company_access_bpo_user ON public.bpo_company_access(bpo_user_id);
CREATE INDEX IF NOT EXISTS idx_bpo_company_access_company ON public.bpo_company_access(company_id);
CREATE INDEX IF NOT EXISTS idx_bpo_company_access_active ON public.bpo_company_access(bpo_user_id, company_id) WHERE revoked_at IS NULL;