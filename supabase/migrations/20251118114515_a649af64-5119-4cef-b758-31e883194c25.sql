-- ================================================================
-- FASE 1: Sincronização de Dados (profiles.role → user_roles)
-- ================================================================
-- 
-- Objetivo: Garantir que todos os usuários com role em 'profiles'
-- também tenham um registro correspondente em 'user_roles'
-- 
-- Esta migração é SEGURA e NÃO quebra nada:
-- - Não deleta dados
-- - Não modifica estrutura de tabelas
-- - Apenas insere registros faltantes
-- ================================================================

-- Inserir em user_roles todos os usuários que ainda não têm registro lá
-- mas têm role definida em profiles
INSERT INTO user_roles (user_id, company_id, role)
SELECT 
  p.user_id,
  p.company_id,
  p.role::app_role
FROM profiles p
WHERE p.role IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p.user_id
      AND (
        ur.company_id = p.company_id 
        OR (p.role = 'master' AND ur.role = 'master')
      )
  )
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Log de quantos registros foram sincronizados
-- (comentado pois é só informativo)
-- SELECT COUNT(*) as registros_sincronizados
-- FROM user_roles
-- WHERE created_at > NOW() - INTERVAL '1 minute';