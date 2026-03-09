-- Restaurar acessos BPO que foram revogados acidentalmente
UPDATE public.bpo_company_access
SET revoked_at = NULL
WHERE bpo_user_id = 'ea574a19-9db4-462e-911a-6ef8ce85ddf4'
  AND revoked_at IS NOT NULL;