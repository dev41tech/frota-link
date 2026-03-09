-- Enable RLS on tire_logs
ALTER TABLE public.tire_logs ENABLE ROW LEVEL SECURITY;

-- Add company_id column for direct RLS filtering
ALTER TABLE public.tire_logs ADD COLUMN IF NOT EXISTS company_id uuid;

-- Backfill company_id from tire_assets (if any data exists)
UPDATE public.tire_logs tl
SET company_id = ta.company_id
FROM public.tire_assets ta
WHERE tl.tire_id = ta.id
AND tl.company_id IS NULL;

-- Make company_id NOT NULL with a default for future inserts
-- (skip NOT NULL constraint since there may be orphaned rows)

-- RLS: Users can view tire logs for their company
CREATE POLICY "Users can view company tire logs"
ON public.tire_logs FOR SELECT TO authenticated
USING (
  public.user_has_company_access(auth.uid(), company_id)
);

-- RLS: Users can insert tire logs for their company
CREATE POLICY "Users can insert company tire logs"
ON public.tire_logs FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_company_access(auth.uid(), company_id)
);

-- RLS: Users can update tire logs for their company
CREATE POLICY "Users can update company tire logs"
ON public.tire_logs FOR UPDATE TO authenticated
USING (
  public.user_has_company_access(auth.uid(), company_id)
);

-- RLS: Users can delete tire logs for their company
CREATE POLICY "Users can delete company tire logs"
ON public.tire_logs FOR DELETE TO authenticated
USING (
  public.user_has_company_access(auth.uid(), company_id)
);