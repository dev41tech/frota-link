-- Atualizar o usuário existente para ser Master
-- Primeiro, vamos buscar o user_id do usuário danielbruno783@gmail.com
UPDATE public.profiles 
SET role = 'master'
WHERE email = 'danielbruno783@gmail.com';

-- Adicionar entrada na tabela user_roles para o usuário Master
-- Vamos buscar o user_id primeiro e depois inserir
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT 
  p.user_id,
  'master'::app_role,
  (SELECT id FROM public.companies LIMIT 1) -- Usar a primeira empresa como padrão
FROM public.profiles p
WHERE p.email = 'danielbruno783@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.user_id AND ur.role = 'master'
);