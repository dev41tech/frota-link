-- Parte A: Permitir acesso a subscription_plans para usuários autenticados
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view subscription plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.companies TO authenticated;

-- Parte B: Restaurar vínculos do usuário BPO (reativar empresas revogadas)
UPDATE public.bpo_company_access
SET revoked_at = NULL,
    updated_at = now()
WHERE bpo_user_id = 'ea574a19-9db4-462e-911a-6ef8ce85ddf4'
  AND revoked_at IS NOT NULL;