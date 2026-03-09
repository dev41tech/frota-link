-- Atualizar auth_user_id do motorista Adriano
UPDATE drivers 
SET auth_user_id = 'f9a7fc4a-de03-438d-b490-c1ebe0705c78'
WHERE email = 'adriano@teste.com.br' 
  AND auth_user_id IS NULL;