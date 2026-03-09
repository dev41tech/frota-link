-- Primeiro, tornar company_id opcional para usuários master na tabela user_roles
ALTER TABLE public.user_roles ALTER COLUMN company_id DROP NOT NULL;

-- Atualizar o usuário existente para ser Master na tabela profiles
UPDATE public.profiles 
SET role = 'master'
WHERE email = 'danielbruno783@gmail.com';

-- Adicionar entrada na tabela user_roles para o usuário Master (sem company_id)
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT 
  p.user_id,
  'master'::app_role,
  NULL -- Master não precisa estar vinculado a uma empresa específica
FROM public.profiles p
WHERE p.email = 'danielbruno783@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.user_id AND ur.role = 'master'
);