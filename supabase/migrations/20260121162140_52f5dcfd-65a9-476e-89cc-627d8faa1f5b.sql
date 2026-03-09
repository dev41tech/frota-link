-- Add soft delete column to cte_documents if not exists
ALTER TABLE public.cte_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;