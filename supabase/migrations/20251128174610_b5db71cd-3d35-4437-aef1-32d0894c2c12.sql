-- Drop políticas RLS incorretas do bucket expense-receipts
DROP POLICY IF EXISTS "Drivers can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view company receipts" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;

-- Política de INSERT: Motoristas podem fazer upload de seus próprios comprovantes
CREATE POLICY "Drivers can upload own receipts" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers
    WHERE drivers.auth_user_id = auth.uid()
    AND (drivers.id)::text = (storage.foldername(name))[2]
    AND (drivers.company_id)::text = (storage.foldername(name))[1]
  )
);

-- Política de SELECT: Motoristas podem visualizar seus próprios comprovantes
CREATE POLICY "Drivers can view own receipts" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers
    WHERE drivers.auth_user_id = auth.uid()
    AND (drivers.id)::text = (storage.foldername(name))[2]
  )
);

-- Política de SELECT: Admins podem visualizar comprovantes da empresa
CREATE POLICY "Admins can view company receipts" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'expense-receipts' AND
  user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Política de UPDATE: Motoristas podem atualizar seus próprios comprovantes
CREATE POLICY "Drivers can update own receipts" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers
    WHERE drivers.auth_user_id = auth.uid()
    AND (drivers.id)::text = (storage.foldername(name))[2]
  )
)
WITH CHECK (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers
    WHERE drivers.auth_user_id = auth.uid()
    AND (drivers.id)::text = (storage.foldername(name))[2]
  )
);

-- Política de DELETE: Motoristas podem deletar seus próprios comprovantes
CREATE POLICY "Drivers can delete own receipts" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers
    WHERE drivers.auth_user_id = auth.uid()
    AND (drivers.id)::text = (storage.foldername(name))[2]
  )
);