-- Adicionar campo para URL da foto de comprovante
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE fuel_expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Criar bucket de storage para comprovantes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts', 
  'expense-receipts', 
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- RLS: Motoristas podem fazer upload de seus próprios comprovantes
CREATE POLICY "Drivers can upload their receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers 
    WHERE auth_user_id = auth.uid()
  )
);

-- RLS: Motoristas podem ver seus próprios comprovantes
CREATE POLICY "Drivers can view own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers 
    WHERE auth_user_id = auth.uid() 
    AND id::text = (storage.foldername(name))[2]
  )
);

-- RLS: Admins da empresa podem ver comprovantes da empresa
CREATE POLICY "Admins can view company receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id::text = (storage.foldername(name))[2]
    AND user_has_company_access(auth.uid(), d.company_id)
  )
);

-- RLS: Permitir deleção de comprovantes (para retentativas)
CREATE POLICY "Drivers can delete own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-receipts' AND
  EXISTS (
    SELECT 1 FROM drivers 
    WHERE auth_user_id = auth.uid() 
    AND id::text = (storage.foldername(name))[2]
  )
);