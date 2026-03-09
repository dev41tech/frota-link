-- Tornar bucket expense-receipts público para permitir acesso às URLs
UPDATE storage.buckets 
SET public = true 
WHERE id = 'expense-receipts';