-- Add billing_kind and deleted_at columns to invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS billing_kind text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_billing_kind ON public.invoices(billing_kind);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices(deleted_at) WHERE deleted_at IS NULL;

-- Add unique partial index for asaas_payment_id to prevent duplicates
-- First, deduplicate existing records (keep the most recent one per asaas_payment_id)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY asaas_payment_id 
    ORDER BY created_at DESC
  ) as rn
  FROM public.invoices
  WHERE asaas_payment_id IS NOT NULL
)
UPDATE public.invoices 
SET deleted_at = now()
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Now create unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_asaas_payment_id_unique 
ON public.invoices(asaas_payment_id) 
WHERE asaas_payment_id IS NOT NULL AND deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.billing_kind IS 'Type of charge: subscription, one_time, or unknown';
COMMENT ON COLUMN public.invoices.deleted_at IS 'Soft delete timestamp';