ALTER TABLE public.freight_requests
  ADD COLUMN collection_address text,
  ADD COLUMN collection_date timestamptz,
  ADD COLUMN collection_notes text,
  ADD COLUMN approved_by_operator_at timestamptz;