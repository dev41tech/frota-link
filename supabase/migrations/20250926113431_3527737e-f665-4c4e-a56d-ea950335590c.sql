-- Remove the orphaned user from auth.users
DELETE FROM auth.users 
WHERE email = 'comercial4@41contabil.com.br';